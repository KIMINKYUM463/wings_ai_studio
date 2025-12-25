FROM python:3.11-slim

# FFmpeg 및 한글 폰트 설치
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fonts-noto-cjk \
    fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY app.py .

# 포트 설정
ENV PORT=8080
EXPOSE 8080

# 애플리케이션 실행 (Gunicorn 사용)
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app

