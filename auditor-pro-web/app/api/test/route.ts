import { NextResponse } from 'next/server'
import { loginPSM } from '@/lib/psm/auth'


export async function GET() {
  try {
    const token = await loginPSM()
    return NextResponse.json({ 
      ok: true, 
      token: token.substring(0, 20) + '...' 
    })
  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    }, { status: 500 })
  }
}
