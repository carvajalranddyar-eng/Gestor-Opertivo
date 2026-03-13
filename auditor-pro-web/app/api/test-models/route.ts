import { NextResponse } from 'next/server';
import axios from 'axios';
import { loginPSM } from '@/lib/psm/auth';

export async function GET() {
  try {
    const token = await loginPSM();
    
    const res = await axios.get(
      `${process.env.PSM_BASE_URL}/test`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    return NextResponse.json({ status: 'ok', data: res.data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
