# 윙즈 Flow 도우미 (Chrome 확장)

윙즈 AI 쇼핑 숏폼 **6단계 AI영상**의 장면을 Google Flow(https://labs.google/fx/tools/flow)에 넣고,
Flow에서 완성된 영상을 다시 그 장면으로 보내 주는 확장입니다.

> **사용자가 직접 누르는 보조 도구입니다. 구글 약관을 확인하고 쓰세요.**
> 한 번에 한 작업만, 모든 단계는 사용자가 버튼을 눌러야 진행됩니다. 보안 확인(reCAPTCHA 등)이 나오면
> 도우미는 멈추고 "Flow에서 확인을 직접 완료해 주세요"라고 안내합니다. 확인을 대신 풀거나 우회하지 않습니다.

## 설치

1. Chrome 주소창에 `chrome://extensions` 입력
2. 오른쪽 위 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램 로드** → 이 폴더(`extensions/wings-flow-helper`) 선택
4. 윙즈 앱 탭을 새로고침 (앱이 확장을 인식하면 "Flow 확장 연결됨"으로 바뀝니다)

## 사용법

1. 윙즈 앱 → AI 쇼핑 숏폼 → 6단계 AI영상 → **Google Flow에서 직접 만들기** 펼치기
2. **Flow 확장으로 보내기** → Flow 탭이 열립니다 (Google 로그인은 직접)
3. 확장 아이콘을 눌러 옆 패널을 열고 **Flow에 넣기** → 이미지·프롬프트가 들어갔는지 확인
4. Flow에서 세로(9:16) 설정을 확인하고 **생성 시작** (또는 Flow의 만들기 버튼을 직접 누르기)
5. 결과 영상 왼쪽 위 **윙즈로 보내기** → 앱의 해당 장면에 영상이 붙고 저장소에 업로드됩니다
   - 패널의 **완성되면 자동으로 보내기**를 켜면, 새 결과가 정확히 1개일 때 자동으로 보냅니다

## 자동 넣기가 안 될 때

Flow 화면 구조는 자주 바뀌어서 이미지/프롬프트 자동 입력이 실패할 수 있습니다.
패널의 **이미지 저장**으로 받은 파일을 Flow에 올리고, **프롬프트 복사** 후 붙여 넣으세요.
결과 영상의 **윙즈로 보내기** 버튼은 그대로 쓸 수 있고, 그것도 안 되면 영상을 내려받아 앱의 **영상 올리기**를 쓰세요.

## 지원 주소

- 앱: `http://localhost:3000`, `https://wingsedit.vercel.app`
- Flow: `https://labs.google/fx/*`

## 메시지 규격 (window.postMessage)

- 앱 → 확장: `{ source: "wings-app", type: "ping" }`, `{ source: "wings-app", type: "flow-job", job: { jobId, sceneIndex, imageDataUrl | imageUrl, prompt, aspect: "9:16" } }`
- 확장 → 앱: `{ source: "wings-flow-helper", type: "hello" | "job-accepted" | "job-error" | "video-result", jobId, sceneIndex, mime, videoBuffer(ArrayBuffer) }`
