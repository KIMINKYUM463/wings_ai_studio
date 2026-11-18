# wingsAIStudio

AI 유튜브 영상 제작 플랫폼 (롱폼·쇼츠·쇼핑 숏폼). Cursor로 개발하다 Claude Code로 이어서 개발 중.

## 스택
- Next.js 14 App Router + React 18 + TypeScript, Tailwind v4, shadcn/ui (`components/ui`), Radix
- 패키지 매니저: **npm** (`package-lock.json`). pnpm/yarn 쓰지 말 것
- 경로 별칭: `@/*` → 루트
- 배포: Vercel (`vercel.json`에 API별 `maxDuration`, cron). 렌더링은 Cloud Run (`cloud-run-service/`)
- DB/인증: Supabase, Kakao 로그인. 스토리지: GCS
- AI: Anthropic, OpenAI, Gemini(`@google/genai`), Replicate, 각종 TTS(ElevenLabs, Typecast, Supertonic, Google, Edge)

## 명령어
- `npm run dev` — next dev(3000) + 로컬 에이전트(3847) 동시 실행
- `npm run dev:next-only` — Next만
- `npm run build` — ffmpeg vendor 복사 후 빌드
- `npx tsc --noEmit` — 타입 체크
- `npm run test:quality-gates` — node:test 기반 테스트 (`tests/quality-gates/*.test.ts`)
- `npm run lint`

## 구조
- `app/` 페이지별 기능: `WingsAIStudio`(롱폼), `WingsAIStudioShotForm`(쇼핑 숏폼: ai-shopping, animal-shopping 등), `longform`, `shorts`, `shopping`, `youtube-*`, `admin`
- `app/api/` API 라우트 (기능명 폴더별 `route.ts`). 오래 걸리는 라우트는 `vercel.json`에 `maxDuration` 추가
- `lib/` 공용 로직 (`mvp-*` = 숏폼 MVP 에디터, `longform-v2/`)
- `scripts/` 로컬 에이전트·렌더·설치 스크립트 (Windows 전용 PowerShell 포함)
- `extensions/` 크롬 확장, `voices/` TTS 보이스
- 루트 `*_프롬프트.md`, `docs/` — 프롬프트·기능명세 문서. 프롬프트 수정 시 참고

## 규칙
- 비밀 파일 읽기·커밋 금지: `.env*`(`.env.example` 제외), `service-account-key.json`, `*-key.json`, `data/*-key.txt`
- 새 환경변수는 `.env.example`에 키만 추가
- 사용자 대면 문구는 한국어
- 줄바꿈 LF, UTF-8 (`.editorconfig`)
- 커밋 메시지: conventional commits (`feat(scope): ...`, `fix: ...`)
- `_mvp_*.tsx`, `_lines.txt`, `diff_*.txt` 등 루트의 `_` 파일은 로컬 스크래치(무시됨)
