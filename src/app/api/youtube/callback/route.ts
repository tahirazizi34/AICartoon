// src/app/api/youtube/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { handleOAuthCallback } from '@/lib/youtube/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=youtube_denied`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=youtube_invalid`
    )
  }

  try {
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString())
    await handleOAuthCallback(code, userId)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=youtube_connected`
    )
  } catch (err) {
    console.error('YouTube callback error:', err)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=youtube_failed`
    )
  }
}
