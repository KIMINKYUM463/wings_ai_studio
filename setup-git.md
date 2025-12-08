# Git 저장소 설정 가이드

## Git Bash 또는 새 터미널에서 실행할 명령어

### 1. 프로젝트 폴더로 이동
```bash
cd C:\Users\a\Downloads\duplicate-of
```

### 2. Git 초기화
```bash
git init
```

### 3. 모든 파일 추가
```bash
git add .
```

### 4. 첫 커밋
```bash
git commit -m "Initial commit: WingsAIStudio"
```

### 5. 브랜치 이름 설정
```bash
git branch -M main
```

### 6. GitHub 저장소 생성
1. https://github.com/new 접속
2. Repository name: `wings-ai-studio` 입력
3. Description: `AI 기반 유튜브 영상 제작 플랫폼`
4. Public 또는 Private 선택
5. "Initialize this repository with a README" 체크 해제
6. "Create repository" 클릭

### 7. 원격 저장소 연결 및 푸시
```bash
# your-username을 실제 GitHub 사용자명으로 변경하세요
git remote add origin https://github.com/your-username/wings-ai-studio.git

# 파일 푸시
git push -u origin main
```

## 다음 단계: Vercel 배포
1. https://vercel.com/dashboard 접속
2. "Add New..." → "Project" 클릭
3. GitHub 저장소 선택
4. 환경 변수 설정 후 배포

