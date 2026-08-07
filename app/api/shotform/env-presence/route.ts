import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** 값 없이 존재 여부만 확인 (배포 환경변수 누락 진단용) */
export async function GET() {
  const present = (key: string) => Boolean(process.env[key]?.trim())
  return NextResponse.json({
    ok: true,
    productionHints: {
      NAVER_SEARCHAD_ACCESS_LICENSE: present("NAVER_SEARCHAD_ACCESS_LICENSE"),
      NAVER_SEARCHAD_SECRET_KEY: present("NAVER_SEARCHAD_SECRET_KEY"),
      NAVER_SEARCHAD_CUSTOMER_ID: present("NAVER_SEARCHAD_CUSTOMER_ID"),
      COUPANG_PARTNERS_ACCESS_KEY: present("COUPANG_PARTNERS_ACCESS_KEY"),
      COUPANG_PARTNERS_SECRET_KEY: present("COUPANG_PARTNERS_SECRET_KEY"),
      OPENAI_API_KEY: present("OPENAI_API_KEY") || present("GPT_API_KEY"),
      NAVER_DATALAB_CLIENT_ID:
        present("NAVER_DATALAB_CLIENT_ID") || present("NAVER_CLIENT_ID"),
      NAVER_DATALAB_CLIENT_SECRET:
        present("NAVER_DATALAB_CLIENT_SECRET") || present("NAVER_CLIENT_SECRET"),
    },
  })
}
