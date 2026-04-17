#!/usr/bin/env node
// scripts/start.js
const { execSync, spawn } = require('child_process')
const fs = require('fs')

const MAX_RETRIES = 5
const RETRY_DELAY_MS = 4000

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function runMigrations() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[startup] Migration attempt ${attempt}/${MAX_RETRIES}...`)
      execSync('npx prisma migrate deploy', { stdio: 'inherit' })
      console.log('[startup] ✓ Migrations complete')
      return
    } catch (err) {
      console.error(`[startup] Migration attempt ${attempt} failed:`, err.message)
      if (attempt === MAX_RETRIES) {
        console.error('[startup] All migration attempts failed — exiting')
        process.exit(1)
      }
      console.log(`[startup] Waiting ${RETRY_DELAY_MS / 1000}s before retry...`)
      await sleep(RETRY_DELAY_MS)
    }
  }
}

async function main() {
  const port     = process.env.PORT || 3000
  const hostname = '0.0.0.0'

  console.log('[startup] ToonForge starting...')
  console.log(`[startup] NODE_ENV=${process.env.NODE_ENV}`)
  console.log(`[startup] PORT=${port}`)
  console.log(`[startup] DATABASE_URL set=${!!process.env.DATABASE_URL}`)

  await runMigrations()

  // Prefer standalone server (output:'standalone'), fall back to next start
  const standaloneServer = '.next/standalone/server.js'
  let proc

  if (fs.existsSync(standaloneServer)) {
    console.log(`[startup] Starting standalone server on ${hostname}:${port}`)
    proc = spawn('node', [standaloneServer], {
      stdio: 'inherit',
      env: { ...process.env, PORT: String(port), HOSTNAME: hostname },
    })
  } else {
    console.log(`[startup] Standalone not found — running next start on ${hostname}:${port}`)
    proc = spawn(
      'node_modules/.bin/next',
      ['start', '-p', String(port), '-H', hostname],
      { stdio: 'inherit', env: { ...process.env } }
    )
  }

  proc.on('error', err => {
    console.error('[startup] Failed to start server process:', err)
    process.exit(1)
  })

  proc.on('exit', (code, signal) => {
    console.log(`[startup] Server exited — code=${code} signal=${signal}`)
    process.exit(code ?? 1)
  })

  process.on('SIGTERM', () => { console.log('[startup] SIGTERM received'); proc.kill('SIGTERM') })
  process.on('SIGINT',  () => { console.log('[startup] SIGINT received');  proc.kill('SIGINT') })
}

main().catch(err => {
  console.error('[startup] Fatal error:', err)
  process.exit(1)
})
