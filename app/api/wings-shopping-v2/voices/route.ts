import { NextResponse } from 'next/server';
import { listVoices } from '@/lib/wings-shopping-v2/tts';
import { err } from '@/lib/wings-shopping-v2/api';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await listVoices());
  } catch (e) {
    return err(e instanceof Error ? e.message : '보이스 목록 실패', 502);
  }
}
