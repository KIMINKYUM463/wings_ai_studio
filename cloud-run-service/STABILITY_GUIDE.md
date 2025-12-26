# Cloud Run 안정성 개선 가이드

## 문제점

현재 Cloud Run 서비스에서 다음과 같은 문제가 발생할 수 있습니다:

1. **콜드 스타트 지연**: 첫 요청 시 인스턴스가 시작되면서 10-30초 지연
2. **네트워크 오류**: 인스턴스가 종료된 후 첫 요청 시 연결 실패
3. **타임아웃**: 긴 렌더링 작업 중 인스턴스가 종료되어 작업 실패

## 해결 방법

### 1. 최소 인스턴스 유지 (가장 효과적)

**장점:**
- 콜드 스타트 완전 제거
- 즉시 응답 가능
- 네트워크 오류 방지

**단점:**
- 항상 비용 발생 (월 약 $30-50)

**설정:**
```bash
--min-instances 1
```

### 2. 동시 요청 수 제한

렌더링 작업은 리소스 집약적이므로 각 인스턴스당 1개 요청만 처리:

```bash
--concurrency 1
```

### 3. 최대 인스턴스 수 설정

트래픽 증가 시 자동 확장:

```bash
--max-instances 10
```

### 4. CPU 스로틀링 활성화

요청이 없을 때 CPU 사용량 감소로 비용 절감:

```bash
--cpu-throttling
```

## 배포 스크립트 사용

### Linux/Mac
```bash
cd cloud-run-service
chmod +x deploy.sh
./deploy.sh
```

### Windows
```cmd
cd cloud-run-service
deploy.bat
```

## 비용 최적화

### 옵션 1: 최소 인스턴스 제거 (비용 절감, 콜드 스타트 발생)

`deploy.sh` 또는 `deploy.bat`에서 `--min-instances 1` 옵션을 제거하세요.

### 옵션 2: 최소 인스턴스 유지 (안정성 우선, 비용 발생)

현재 배포 스크립트는 이미 최소 인스턴스 1개를 유지하도록 설정되어 있습니다.

## 모니터링

Google Cloud Console에서 다음을 확인하세요:

1. **Cloud Run 서비스 페이지**
   - 인스턴스 수
   - 요청 수
   - 오류율
   - 평균 응답 시간

2. **비용 관리**
   - Cloud Billing > Reports
   - Cloud Run 사용량 및 비용 확인

## 문제 해결

### 문제: 여전히 "fetch failed" 오류 발생

**해결 방법:**
1. Cloud Run 서비스가 실행 중인지 확인
2. 헬스 체크 엔드포인트 확인: `GET /health`
3. 최소 인스턴스가 1개로 설정되어 있는지 확인
4. 네트워크 연결 확인

### 문제: 비용이 너무 높음

**해결 방법:**
1. 최소 인스턴스를 제거 (콜드 스타트 발생 가능)
2. CPU 스로틀링 활성화 확인
3. 사용하지 않는 시간대에 인스턴스 수 줄이기 (수동 조정 필요)

### 문제: 렌더링이 느림

**해결 방법:**
1. 메모리/CPU 할당 증가: `--memory 8Gi --cpu 4`
2. 동시 요청 수 조정: `--concurrency 2` (주의: 메모리 부족 가능)
3. 최대 인스턴스 수 증가: `--max-instances 20`

## 권장 설정

### 안정성 우선 (현재 설정)
```bash
--min-instances 1
--max-instances 10
--concurrency 1
--cpu-throttling
--memory 4Gi
--cpu 2
--timeout 3600
```

### 비용 우선
```bash
# min-instances 제거
--max-instances 10
--concurrency 1
--cpu-throttling
--memory 4Gi
--cpu 2
--timeout 3600
```

### 성능 우선
```bash
--min-instances 1
--max-instances 20
--concurrency 1
--cpu-throttling
--memory 8Gi
--cpu 4
--timeout 3600
```

