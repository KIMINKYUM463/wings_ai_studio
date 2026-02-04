# Git 배포 가이드

이 문서는 WingsAIStudio 프로젝트를 Git을 통해 배포하는 방법을 안내합니다.

## 📋 현재 상태

- ✅ Git 저장소 초기화 완료
- ✅ 원격 저장소 연결: `https://github.com/KIMINKYUM463/wings_ai_studio.git`
- ✅ 브랜치: `main`
- ✅ Vercel 배포 설정 파일 존재 (`vercel.json`)

## 🚀 배포 방법

### 방법 1: Vercel 자동 배포 (권장)

Vercel은 GitHub 저장소와 연동하여 자동으로 배포할 수 있습니다.

#### 1단계: Vercel 프로젝트 연결

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. "Add New..." → "Project" 클릭
3. GitHub 저장소 선택: `KIMINKYUM463/wings_ai_studio`
4. 프로젝트 설정:
   - **Framework Preset**: Next.js (자동 감지)
   - **Root Directory**: `./` (기본값)
   - **Build Command**: `npm run build` (기본값)
   - **Output Directory**: `.next` (기본값)

#### 2단계: 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수를 설정하세요:

**필수 환경 변수:**
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Google Cloud 관련:**
```
GOOGLE_CLOUD_PROJECT_ID=test-ai-450613
GOOGLE_CLOUD_STORAGE_BUCKET=video-renderer-storage
NEXT_PUBLIC_CLOUD_RUN_RENDER_URL=https://my-project-gs3pokkvsa-an.a.run.app
```

**카카오 로그인:**
```
KAKAO_REST_API_KEY=29e0cf48de7d7a8fecec3d729db037d6
KAKAO_CLIENT_SECRET=JHpR3y0b1QQoxS0MaomVcGFfXzHfdMEi
```

**기타 API 키:**
```
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_key
```

#### 3단계: 배포

1. "Deploy" 버튼 클릭
2. 배포 완료 후 자동으로 URL 제공
3. 이후 `main` 브랜치에 푸시할 때마다 자동 배포됨

### 방법 2: 수동 Git 푸시 및 배포

#### 1단계: 변경사항 확인

```bash
git status
```

#### 2단계: 변경사항 스테이징

```bash
git add .
```

#### 3단계: 커밋

```bash
git commit -m "feat: 배포를 위한 변경사항"
```

#### 4단계: 원격 저장소에 푸시

```bash
git push origin main
```

#### 5단계: Vercel 자동 배포 확인

- Vercel이 자동으로 변경사항을 감지하고 배포를 시작합니다
- Vercel 대시보드에서 배포 상태를 확인할 수 있습니다

### 방법 3: GitHub Actions를 통한 자동 배포

GitHub Actions를 사용하여 자동 배포 파이프라인을 설정할 수 있습니다.

#### GitHub Actions 워크플로우 생성

`.github/workflows/deploy.yml` 파일을 생성하여 자동 배포를 설정할 수 있습니다.

## 📝 배포 전 체크리스트

배포 전에 다음 사항을 확인하세요:

- [ ] `.env.local` 파일의 민감한 정보가 Git에 커밋되지 않았는지 확인
- [ ] `service-account-key.json` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] 환경 변수가 Vercel에 올바르게 설정되어 있는지 확인
- [ ] 빌드 오류가 없는지 확인 (`npm run build` 실행)
- [ ] 타입스크립트 오류 확인 (`npm run lint` 실행)

## 🔧 배포 문제 해결

### 빌드 오류 발생 시

1. 로컬에서 빌드 테스트:
   ```bash
   npm run build
   ```

2. 오류 메시지 확인 및 수정

3. 다시 커밋 및 푸시:
   ```bash
   git add .
   git commit -m "fix: 빌드 오류 수정"
   git push origin main
   ```

### 환경 변수 누락 시

1. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
2. 누락된 환경 변수 추가
3. 재배포 실행

### 배포 속도 개선

- Vercel의 Edge Network를 활용하여 전 세계에 빠르게 배포됩니다
- 이미지 최적화는 `next.config.mjs`에서 설정할 수 있습니다

## 🔐 보안 주의사항

⚠️ **중요**: 다음 파일들은 절대 Git에 커밋하지 마세요:

- `.env.local`
- `service-account-key.json`
- `*-key.json`
- `*-credentials.json`

이러한 파일들은 `.gitignore`에 포함되어 있습니다.

## 📚 추가 리소스

- [Vercel 공식 문서](https://vercel.com/docs)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [Git 기본 명령어](https://git-scm.com/docs)

## 🆘 도움이 필요하신가요?

배포 중 문제가 발생하면:
1. Vercel 대시보드의 배포 로그 확인
2. GitHub Actions 로그 확인 (사용하는 경우)
3. 로컬 빌드 테스트로 문제 재현

