# Supertonic 커스텀 보이스

| 파일 | 서버 voice id | UI 표시 |
|------|---------------|---------|
| `yeoseong1.json` | `yeoseong1` | 여자목소리1 · 커스텀 |
| `namseong1.json` | `namseong1` | 남자목소리1 · 커스텀 |

## 자동 설치·기동 (권장)

ShotForm에서 **Supertonic 3**를 선택하면:

1. PC에 설치돼 있는지 확인
2. 없으면 `pip install 'supertonic[serve]'` 자동 설치 (Python 3 필요)
3. `supertonic serve --host 127.0.0.1 --port 7788 --model supertonic-3` 자동 기동

수동 실행: `npm run shotform:ensure-supertonic`  
(로컬 `npm run dev`에서만 동작. Vercel 배포 서버에서는 불가)

## ShotForm에서 학습용 녹음

1. (자동 기동되지 않았다면) `supertonic serve --host 127.0.0.1 --port 7788 --model supertonic-3`
2. AI 음성 → Supertonic 3 → **학습용 녹음 (10초)**
3. 녹음이 끝나면 자동으로 JSON 생성 → 로컬 서버에 import → 보이스 선택까지 진행됩니다.
4. 결과 JSON은 `voices/supertonic/<이름>.json`, 샘플은 `voices/supertonic/samples/` 에 저장됩니다.

> 로컬 open-weight 모델에는 공식 보이스 인코더가 없어, 자동 등록은 **가장 비슷한 내장 스타일(F1–M5)을 선택**하는 방식입니다.  
> 완전 동일 클론 JSON이 있으면 다이얼로그의 **JSON으로 등록**을 사용하세요.

## 수동 import

```powershell
powershell -File scripts/import-supertonic-voices.ps1
```

한 번 import하면 `%USERPROFILE%\.cache\supertonic3\custom_styles\` 에 저장되어  
서버를 다시 켜도 유지됩니다.
