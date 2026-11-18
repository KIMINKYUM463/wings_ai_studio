import { NextResponse } from 'next/server';
import { THUMB_STYLES } from '@/lib/wings-shopping-v2/thumbnails/catalog';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(THUMB_STYLES.map(({ id, name, description }) => ({ id, name, description })));
}
