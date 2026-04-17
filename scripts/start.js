#!/usr/bin/env node
// scripts/start.js
// Runs DB migrations (with retry) then starts the Next.js server.

const { execSync, spawn } = require('child_process')
const fs = require('fs')

const MAX_RETRIES = 5
const RETRY_DELAY_MS = 3000

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function runMigrations() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[startup] Migration attempt ${attempt}/${MAX_RETRIES}...`)
      execSync('npx prisma migrate deploy', { stdio: 'inherit' })
      console.log('[startup] Migrations complete.')
      return
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        console.error('[startup] All migration attempts failed.')
        process.exit(1)
      }
      console.warn(`[startup] Retrying in ${RETRY_DELAY_MS / 1000}s...`)
      await sleep(RETRY_DELAY_MS)
    }
  }
}

async function main() {
  await runMigrations()

  const port     = process.env.PORT || 3000
  const hostname = '0.0.0.0'

  // Use standalone server if available (output: 'standalone' in next.config.js)
  // Fall back to `next start` otherwise
  const standaloneServer = '.next/standalone/server.js'
  let serverProcess

  if (fs.existsSync(standaloneServer)) {
    console.log(`[startup] Starting standalone server on ${hostname}:${port}`)
    serverProcess = spawn('node', [standaloneServer], {
      stdio: 'inherit',
      env: { ...process.env, PORT: String(port), HOSTNAME: hostname },
    })
  } else {
    console.log(`[startup] Starting via next start on port ${port}`)
    serverProcess = spawn(
      'node_modules/.bin/next',
      ['start', '-p', String(port), '-H', hostname],
      { stdio: 'inherit', env: process.env }
    )
  }

  serverProcess.on('exit', code => {
    console.log(`[startup] Process exited with code ${code}`)
    process.exit(code ?? 1)
  })

  process.on('SIGTERM', () => serverProcess.kill('SIGTERM'))
  process.on('SIGINT',  () => serverProcess.kill('SIGINT'))
}

main().catch(err => {
  console.error('[startup] Fatal:', err)
  process.exit(1)
})
