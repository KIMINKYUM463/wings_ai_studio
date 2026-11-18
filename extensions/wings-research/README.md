# WINGS Research Local

회사 배포본 기반 복구 + **로컬 API 구현** 빌드 (`0.3.65.8`).

팝업/설정 UI는 WINGS 전용입니다. 페이지 오버레이는 하입덕 마스코트·보라 테마·SaaS 링크를 제거한 WINGS 스킨을 사용합니다.

## 로드

1. `chrome://extensions` → 개발자 모드
2. 압축해제된 확장 프로그램 로드 → 이 폴더
3. 확장 **세부정보 → 확장 프로그램 옵션** 에서 API 키 입력

## 설정에서 넣는 키

| 키 | 용도 |
|----|------|
| OpenAI API Key | Threads 문장 생성, 분석, Enrich, 캡션 링크 보조 |
| OpenAI Model / Base URL | 기본 `gpt-4o-mini` / `https://api.openai.com/v1` |
| 쿠팡 Access / Secret / Sub ID | 파트너스 딥링크 변환 |
| Replicate Token | (선택) 저장만 — 추후 비전 분석 |

## 구현된 로컬 서비스

- `SAVE_RESULTS` / `GET_RESULTS` → `chrome.storage.local`
- `THREADS_STUDIO_GENERATE` → OpenAI
- `START_ANALYSIS` / `ENRICH_REEL` → OpenAI
- `CONVERT_COUPANG_LINK` → Coupang Partners Deeplink API
- `LOAD_PERSONAS` / `SAVE_DECISIONS` / `PARSE_CAPTION_LINK` → 로컬(+OpenAI 보조)
- 플랫폼 오버레이·다운로드 → 배포본 콘텐츠 스크립트

## 파일

- `wings-config.js` / `wings-services.js` — 로컬 서비스
- `options.html` (= wings-options) — API 키 설정
- `options-legacy.html` — 기존 오버레이/스캔 UI
- `background.core.js` — 배포 로직 + Wings 연결
- 하입덕 백업/미사용 파일은 `scripts/` 쪽으로 이동됨 (확장 패키지에 포함하지 않음)
