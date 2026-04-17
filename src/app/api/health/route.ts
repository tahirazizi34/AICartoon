// src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: 'connected', ts: new Date().toISOString() })
  } catch {
    return NextResponse.json({ ok: false, db: 'error' }, { status: 503 })
  }
}
