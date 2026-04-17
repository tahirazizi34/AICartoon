export const dynamic = 'force-dynamic'
// src/app/api/health/route.ts
// Lightweight healthcheck - does NOT query DB so it responds even during migration.
// Railway uses this to know the process is alive and listening.
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  })
}
