#!/usr/bin/env python3
"""
Google Cloud Storage 버킷에 CORS 설정을 적용하는 스크립트
"""

from google.cloud import storage
import json

# 프로젝트 및 버킷 정보
PROJECT_ID = "test-ai-450613"
BUCKET_NAME = "video-renderer-storage"

# CORS 설정
CORS_CONFIG = [
    {
        "origin": ["https://wingsaistudio.com", "https://www.wingsaistudio.com", "http://localhost:3000"],
        "method": ["GET", "PUT", "POST", "HEAD", "DELETE"],
        "responseHeader": ["Content-Type", "Content-Length", "Access-Control-Allow-Origin"],
        "maxAgeSeconds": 3600
    }
]

def set_cors():
    """버킷에 CORS 설정 적용"""
    try:
        # Storage 클라이언트 생성
        client = storage.Client(project=PROJECT_ID)
        bucket = client.bucket(BUCKET_NAME)
        
        # CORS 설정 적용
        bucket.cors = CORS_CONFIG
        bucket.patch()
        
        print(f"✅ CORS 설정이 성공적으로 적용되었습니다!")
        print(f"버킷: {BUCKET_NAME}")
        print(f"CORS 설정:")
        print(json.dumps(CORS_CONFIG, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        print("\n환경 변수 확인:")
        print("1. GOOGLE_APPLICATION_CREDENTIALS 환경 변수가 설정되어 있는지 확인")
        print("2. 또는 서비스 계정 키 파일 경로를 확인")
        return False
    
    return True

if __name__ == "__main__":
    set_cors()

