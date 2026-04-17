// src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  studioName: z.string().min(1).max(60),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, studioName } = schema.parse(body)

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        studioName,
        settings: {
          create: {}, // create default settings
        },
      },
    })

    const session = await getSession()
    session.userId = user.id
    session.email = user.email
    session.studioName = user.studioName
    await session.save()

    return NextResponse.json({ ok: true, studioName: user.studioName }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('Signup error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
