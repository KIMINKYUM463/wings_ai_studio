# Cloud Run 쿼터 오류 해결 가이드

## 오류 원인

16GB 메모리 + 8 CPU 설정 시 발생하는 오류:
- **CPU 쿼터 초과**: requested 800000, allowed 200000
- **메모리 쿼터 초과**: requested 1717986918400, allowed 429496729600
- **최대 인스턴스 제한**: 25개 이하로 설정 필요

## 쿼터 계산

### 현재 프로젝트 쿼터 (asia-northeast1 리전)
- **CPU**: 최대 200 vCPU (200000 밀리코어)
- **메모리**: 최대 400GB (429496729600 bytes)

### 16GB + 8 CPU 설정 시 필요한 리소스
- **최대 인스턴스 10개 기준**:
  - CPU: 10 * 8 = 80 vCPU ✅ (쿼터 내)
  - 메모리: 10 * 16GB = 160GB ✅ (쿼터 내)

- **최대 인스턴스 20개 기준**:
  - CPU: 20 * 8 = 160 vCPU ✅ (쿼터 내)
  - 메모리: 20 * 16GB = 320GB ✅ (쿼터 내)

- **최대 인스턴스 25개 기준**:
  - CPU: 25 * 8 = 200 vCPU ✅ (쿼터 한계)
  - 메모리: 25 * 16GB = 400GB ✅ (쿼터 한계)

## 해결 방법

### 방법 1: 최대 인스턴스 수 줄이기 (권장)

16GB + 8 CPU를 사용하면서 최대 인스턴스를 25개 이하로 설정:

```bash
--memory 16Gi \
--cpu 8 \
--max-instances 20 \  # 25개 이하로 설정
```

### 방법 2: 리소스 줄이기

쿼터 내에서 안전하게 사용:

```bash
--memory 8Gi \   # 16GB → 8GB
--cpu 4 \        # 8 → 4
--max-instances 10 \
```

### 방법 3: 쿼터 증가 요청

Google Cloud Console에서 쿼터 증가 요청:
1. Cloud Console > IAM & Admin > Quotas
2. `CpuAllocPerProjectRegion` 검색
3. 쿼터 증가 요청

## 권장 설정

### 옵션 A: 고성능 (쿼터 한계 근처)
```bash
--memory 16Gi \
--cpu 8 \
--max-instances 20 \  # 쿼터 내에서 안전
--min-instances 1 \
```

### 옵션 B: 균형잡힌 설정 (권장)
```bash
--memory 8Gi \
--cpu 4 \
--max-instances 10 \
--min-instances 1 \
```

### 옵션 C: 현재 설정 유지
```bash
--memory 4Gi \
--cpu 2 \
--max-instances 10 \
--min-instances 1 \
```

