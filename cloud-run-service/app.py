"""
Cloud Run 영상 렌더링 서비스
FFmpeg-python을 사용한 안정적인 렌더링
"""

from flask import Flask, request, jsonify
import os
import sys
import datetime
import ffmpeg
import subprocess
import threading
import uuid
from collections import defaultdict

app = Flask(__name__)

# 작업 상태 저장 (메모리 기반, 프로덕션에서는 Redis 등 사용 권장)
job_status = defaultdict(dict)

# Cloud Run의 요청 크기 제한은 32MB이지만, Flask 앱 레벨에서도 제한 설정
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32MB

# CORS 헤더 추가 함수
def add_cors_headers(response):
    """모든 응답에 CORS 헤더 추가"""
    origin = request.headers.get('Origin', '')
    
    # 허용된 origin 목록
    allowed_origins = ['https://wingsaistudio.com', 'http://localhost:3000']
    
    # Vercel 프리뷰 URL도 허용
    if origin and origin.endswith('.vercel.app'):
        allowed_origins.append(origin)
    
    # Origin이 허용된 목록에 있으면 CORS 헤더 추가
    if origin in allowed_origins:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
        response.headers['Access-Control-Max-Age'] = '3600'
    elif not origin:
        # Origin 헤더가 없는 경우 (같은 origin 요청) 기본값 설정
        response.headers['Access-Control-Allow-Origin'] = 'https://wingsaistudio.com'
    
    return response

@app.after_request
def after_request(response):
    """모든 응답 후 CORS 헤더 추가"""
    return add_cors_headers(response)

@app.route('/render', methods=['POST', 'OPTIONS'])
def render_video():
    # OPTIONS 요청 처리 (CORS preflight)
    if request.method == 'OPTIONS':
        response = jsonify({})
        return add_cors_headers(response), 200
    """
    영상 렌더링 엔드포인트
    현재는 테스트용으로 간단한 응답만 반환
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({
                "success": False,
                "error": "요청 데이터가 없습니다."
            }), 400
        
        # 비동기 모드 확인
        async_mode = data.get('asyncMode', False)
        
        # 요청 데이터 확인
        audio_base64 = data.get('audioBase64')
        audio_gcs_url = data.get('audioGcsUrl')  # Cloud Storage URL
        subtitles = data.get('subtitles', [])
        show_subtitles = data.get('showSubtitles', True)  # 자막 표시 여부 (기본값: True)
        character_image = data.get('characterImage')  # base64 이미지
        character_image_gcs_url = data.get('characterImageGcsUrl')  # Cloud Storage URL 이미지
        character_image_url = data.get('characterImageUrl')  # 영상 URL
        auto_images = data.get('autoImages', [])  # 여러 이미지 배열
        duration = data.get('duration', 0)
        
        # 비동기 모드: 작업 시작 후 jobId 반환
        if async_mode:
            job_id = str(uuid.uuid4())
            print(f"[Render] 비동기 모드: 작업 시작 - jobId: {job_id}")
            
            # 작업 상태 초기화
            job_status[job_id] = {
                'status': 'processing',
                'progress': 0,
                'videoUrl': None,
                'downloadUrl': None,
                'videoBase64': None,
                'error': None,
                'message': '렌더링 작업이 시작되었습니다.',
            }
            
            # 백그라운드에서 렌더링 시작
            def render_async():
                try:
                    job_status[job_id]['status'] = 'processing'
                    job_status[job_id]['progress'] = 5
                    job_status[job_id]['message'] = '렌더링 시작...'
                    
                    # 기존 렌더링 로직 실행 (execute_render_logic 함수 호출)
                    result = execute_render_logic(
                        audio_base64=audio_base64,
                        audio_gcs_url=audio_gcs_url,
                        subtitles=subtitles,
                        show_subtitles=show_subtitles,
                        character_image=character_image,
                        character_image_gcs_url=character_image_gcs_url,
                        character_image_url=character_image_url,
                        auto_images=auto_images,
                        duration=duration,
                        job_id=job_id,
                        job_status_dict=job_status
                    )
                    
                    # 결과 저장
                    if result.get('success'):
                        job_status[job_id]['status'] = 'completed'
                        job_status[job_id]['progress'] = 100
                        job_status[job_id]['message'] = '렌더링 완료'
                        job_status[job_id]['videoUrl'] = result.get('videoUrl')
                        job_status[job_id]['videoBase64'] = result.get('videoBase64')
                        job_status[job_id]['downloadUrl'] = result.get('downloadUrl')
                    else:
                        job_status[job_id]['status'] = 'failed'
                        job_status[job_id]['error'] = result.get('error', '알 수 없는 오류')
                        job_status[job_id]['message'] = f'렌더링 실패: {result.get("error", "알 수 없는 오류")}'
                    
                except Exception as e:
                    import traceback
                    error_trace = traceback.format_exc()
                    print(f"[Render] 비동기 렌더링 오류: {str(e)}\n{error_trace}")
                    job_status[job_id]['status'] = 'failed'
                    job_status[job_id]['error'] = str(e)
                    job_status[job_id]['message'] = f'렌더링 실패: {str(e)}'
            
            # 백그라운드 스레드 시작
            thread = threading.Thread(target=render_async)
            thread.daemon = True
            thread.start()
            
            # 즉시 jobId 반환
            return jsonify({
                "success": True,
                "jobId": job_id,
                "status": "processing",
                "message": "렌더링 작업이 시작되었습니다.",
            }), 200
        
        if not audio_base64 and not audio_gcs_url:
            return jsonify({
                "success": False,
                "error": "audioBase64 또는 audioGcsUrl이 필요합니다."
            }), 400
        
        if not character_image and not character_image_gcs_url and not character_image_url:
            return jsonify({
                "success": False,
                "error": "characterImage, characterImageGcsUrl 또는 characterImageUrl이 필요합니다."
            }), 400
        
        print(f"[Render] 동기 모드: 렌더링 시작 - duration: {duration}s, subtitles: {len(subtitles)}, autoImages: {len(auto_images)}")
        
        # 동기 모드: execute_render_logic 함수 호출
        result = execute_render_logic(
            audio_base64=audio_base64,
            audio_gcs_url=audio_gcs_url,
            subtitles=subtitles,
            show_subtitles=show_subtitles,
            character_image=character_image,
            character_image_gcs_url=character_image_gcs_url,
            character_image_url=character_image_url,
            auto_images=auto_images,
            duration=duration,
            job_id=None,
            job_status_dict=None
        )
        
        # 결과를 jsonify로 변환하여 반환
        if result.get('success'):
            return jsonify({
                "success": True,
                "videoUrl": result.get('videoUrl'),
                "videoBase64": result.get('videoBase64'),
                "downloadUrl": result.get('downloadUrl'),
                "projectId": result.get('projectId', f"project_{int(time.time())}")
            })
        else:
            return jsonify({
                "success": False,
                "error": result.get('error', '알 수 없는 오류'),
                "details": result.get('details', '')
            }), 500
        
    except Exception as e:
        print(f"[Render] 에러: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"오류 발생: {str(e)}"
        }), 500

def execute_render_logic(audio_base64, audio_gcs_url, subtitles, show_subtitles,
                        character_image, character_image_gcs_url, character_image_url,
                        auto_images, duration, job_id=None, job_status_dict=None):
    """
    실제 렌더링 로직을 실행하는 함수
    비동기 모드와 동기 모드 모두에서 사용
    
    Returns:
        dict: {
            'success': bool,
            'videoUrl': str or None,
            'videoBase64': str or None,
            'downloadUrl': str or None,
            'projectId': str or None,
            'error': str or None,
            'details': str or None
        }
    """
    # 진행률 업데이트 함수 (비동기 모드일 때만)
    def update_progress(progress, message):
        if job_id and job_status_dict:
            job_status_dict[job_id]['progress'] = progress
            job_status_dict[job_id]['message'] = message
    
    import subprocess
    import tempfile
    import base64
    import time
    import requests
    import shutil
    import traceback
    import os
    import glob
    
    # 고유 ID 생성
    unique_id = str(uuid.uuid4()).replace('-', '')[:12]
    temp_dir = None
    
    try:
        update_progress(10, '오디오 처리 중...')
        
        if audio_base64:
            print(f"[Render] 시작 - 오디오 크기: {len(audio_base64) / 1024:.2f} KB")
        elif audio_gcs_url:
            print(f"[Render] 시작 - Cloud Storage URL 사용: {audio_gcs_url}")
        
        # 임시 파일 디렉토리 생성
        temp_dir = tempfile.mkdtemp()
        print(f"[Render] Temp directory created: {temp_dir}")
        
        # 자막 타이밍 조정을 위한 변수 초기화
        duration_ratio = 1.0
        actual_audio_duration = duration
        
        # 1. 오디오 다운로드/디코딩
        try:
                if audio_gcs_url:
                    # Cloud Storage에서 다운로드
                    print(f"[Render] Downloading audio from Cloud Storage...")
                    audio_response = requests.get(audio_gcs_url, timeout=300)
                    audio_response.raise_for_status()
                    audio_data = audio_response.content
                    print(f"[Render] Audio downloaded from GCS: {len(audio_data) / 1024 / 1024:.2f} MB")
                else:
                    # base64 디코딩
                    audio_data = base64.b64decode(audio_base64)
                    print(f"[Render] Audio decoded from base64: {len(audio_data) / 1024 / 1024:.2f} MB")
                
                # 오디오 형식 자동 감지 (WAV 또는 MP3)
                # FFmpeg가 자동으로 형식을 감지하므로 확장자는 중요하지 않음
                audio_path = f"{temp_dir}/audio.wav"
                with open(audio_path, 'wb') as f:
                    f.write(audio_data)
                print(f"[Render] Audio saved: {len(audio_data) / 1024 / 1024:.2f} MB")
                
                # 실제 오디오 정보 측정 (ffprobe 사용) - 길이, 코덱, 비트레이트, 샘플레이트, 채널 수
                audio_codec = None
                audio_bitrate = None
                audio_sample_rate = None
                audio_channels = None
                try:
                    import json
                    probe_cmd = [
                        'ffprobe',
                        '-v', 'quiet',
                        '-print_format', 'json',
                        '-show_format',
                        '-show_streams',
                        audio_path
                    ]
                    probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=30)
                    if probe_result.returncode == 0:
                        probe_data = json.loads(probe_result.stdout)
                        actual_audio_duration = float(probe_data.get('format', {}).get('duration', 0))
                        print(f"[Render] Actual audio duration: {actual_audio_duration:.3f}s (requested: {duration}s)")
                        
                        # 오디오 스트림 정보 추출
                        audio_streams = [s for s in probe_data.get('streams', []) if s.get('codec_type') == 'audio']
                        if audio_streams:
                            audio_stream = audio_streams[0]
                            audio_codec = audio_stream.get('codec_name', '')
                            audio_sample_rate = audio_stream.get('sample_rate', '')
                            audio_channels = audio_stream.get('channels', '')
                            
                            # 비트레이트 추출 (format 또는 stream에서)
                            audio_bitrate = probe_data.get('format', {}).get('bit_rate', '')
                            if not audio_bitrate and audio_stream.get('bit_rate'):
                                audio_bitrate = audio_stream.get('bit_rate')
                            
                            print(f"[Render] Original audio info - codec: {audio_codec}, bitrate: {audio_bitrate}, sample_rate: {audio_sample_rate}, channels: {audio_channels}")
                        
                        # 실제 오디오 길이와 요청된 duration이 다르면 자막 타이밍 조정
                        if actual_audio_duration > 0 and duration > 0:
                            duration_ratio = actual_audio_duration / duration
                            print(f"[Render] Duration ratio: {duration_ratio:.4f} (will adjust subtitle timings)")
                        else:
                            duration_ratio = 1.0
                    else:
                        print(f"[Render] Warning: Could not probe audio duration, using requested duration")
                        duration_ratio = 1.0
                        actual_audio_duration = duration
                except Exception as probe_error:
                    print(f"[Render] Warning: Audio probe failed: {str(probe_error)}, using requested duration")
                    duration_ratio = 1.0
                    actual_audio_duration = duration
            except Exception as e:
                print(f"[Render] 오디오 처리 오류: {str(e)}")
                raise Exception(f"오디오 처리 실패: {str(e)}")
            
            # 2. 이미지 처리 (여러 이미지 지원)
            def download_image(img_url, output_path):
                """이미지를 다운로드하여 저장하는 헬퍼 함수 (WebP는 PNG로 변환)"""
                from PIL import Image
                import io
                
                if img_url.startswith("data:"):
                    # data URL 처리
                    if "," in img_url:
                        header, b64data = img_url.split(",", 1)
                        img_data = base64.b64decode(b64data)
                    else:
                        img_data = base64.b64decode(img_url)
                else:
                    # HTTP/HTTPS URL 처리
                    img_response = requests.get(img_url, timeout=30)
                    img_response.raise_for_status()
                    img_data = img_response.content
                
                # 이미지를 PIL로 열어서 PNG로 변환
                try:
                    img = Image.open(io.BytesIO(img_data))
                    # RGB 모드로 변환 (RGBA인 경우)
                    if img.mode in ('RGBA', 'LA', 'P'):
                        # 투명도가 있는 경우 흰색 배경에 합성
                        rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                        if img.mode == 'P':
                            img = img.convert('RGBA')
                        rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                        img = rgb_img
                    elif img.mode != 'RGB':
                        img = img.convert('RGB')
                    
                    # PNG로 저장
                    full_path = f"{output_path}.png"
                    img.save(full_path, 'PNG', optimize=True)
                    print(f"[Render] Image converted to PNG: {full_path} (original format: {img.format if hasattr(img, 'format') else 'unknown'})")
                    return full_path
                except Exception as e:
                    print(f"[Render] Image conversion error: {str(e)}, trying to save as-is")
                    # 변환 실패 시 원본 그대로 저장 (확장자 추측)
                    img_ext = 'png'
                    if img_url.lower().endswith('.jpg') or img_url.lower().endswith('.jpeg'):
                        img_ext = 'jpg'
                    elif img_url.lower().endswith('.webp'):
                        img_ext = 'webp'
                    
                    full_path = f"{output_path}.{img_ext}"
                    with open(full_path, 'wb') as f:
                        f.write(img_data)
                    return full_path
            
            # 기본 배경 이미지 (character_image, character_image_gcs_url 또는 character_image_url)
            try:
                if character_image_gcs_url:
                    # Cloud Storage URL에서 다운로드
                    print(f"[Render] Processing background image from Cloud Storage: {character_image_gcs_url}")
                    img_path = download_image(character_image_gcs_url, f"{temp_dir}/background")
                    print(f"[Render] Background image downloaded from GCS: {img_path}")
                elif character_image_url:
                    # 영상 URL인 경우 다운로드
                    print(f"[Render] Processing background video from URL: {character_image_url[:50]}...")
                    video_response = requests.get(character_image_url, timeout=300, headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*',
                    }, stream=True)
                    video_response.raise_for_status()
                    video_file_path = f"{temp_dir}/background_video.mp4"
                    with open(video_file_path, 'wb') as f:
                        for chunk in video_response.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                    img_path = video_file_path
                    print(f"[Render] Background video downloaded: {img_path}")
                elif character_image:
                    # base64 이미지 처리
                    print(f"[Render] Processing background image: {character_image[:50]}...")
                    img_path = download_image(character_image, f"{temp_dir}/background")
                    print(f"[Render] Background image saved: {img_path}")
                else:
                    raise Exception("characterImage, characterImageGcsUrl 또는 characterImageUrl이 필요합니다.")
            except Exception as e:
                print(f"[Render] Background image processing error: {str(e)}")
                raise Exception(f"Background image processing failed: {str(e)}")
            
            # autoImages 처리 (여러 이미지/비디오 다운로드)
            image_segments = []  # [(image_path, start_time, end_time, is_video), ...]
            
            if auto_images and len(auto_images) > 0:
                print(f"[Render] Processing {len(auto_images)} auto images/videos...")
                for idx, auto_img in enumerate(auto_images):
                    try:
                        img_url = auto_img.get('url', '')
                        start_time = float(auto_img.get('startTime', 0))
                        end_time = float(auto_img.get('endTime', start_time + 1))
                        is_video = auto_img.get('isVideo', False)
                        
                        # 마지막 이미지인 경우 실제 오디오 길이에 맞춰 end_time 조정
                        is_last_image = (idx == len(auto_images) - 1)
                        if is_last_image and actual_audio_duration > 0:
                            # 실제 오디오 길이 + 3초 여유를 목표로 설정
                            target_end_time = actual_audio_duration + 3
                            if end_time < target_end_time:
                                print(f"[Render] 마지막 이미지 endTime 조정: {end_time:.3f}s -> {target_end_time:.3f}s (실제 오디오 길이: {actual_audio_duration:.3f}s)")
                                end_time = target_end_time
                            elif end_time > target_end_time:
                                print(f"[Render] 마지막 이미지 endTime 제한: {end_time:.3f}s -> {target_end_time:.3f}s (실제 오디오 길이: {actual_audio_duration:.3f}s)")
                                end_time = target_end_time
                        
                        if img_url:
                            if is_video:
                                # 영상 URL인 경우 다운로드
                                print(f"[Render] Downloading video {idx+1} from URL: {img_url[:50]}...")
                                try:
                                    # CORS 및 인증 문제를 피하기 위해 헤더 추가
                                    headers = {
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                        'Accept': '*/*',
                                    }
                                    video_response = requests.get(img_url, timeout=300, headers=headers, stream=True)
                                    video_response.raise_for_status()
                                    
                                    # 스트림으로 다운로드하여 메모리 효율성 향상
                                    video_file_path = f"{temp_dir}/video_{idx}.mp4"
                                    with open(video_file_path, 'wb') as f:
                                        for chunk in video_response.iter_content(chunk_size=8192):
                                            if chunk:
                                                f.write(chunk)
                                    
                                    # 파일이 제대로 다운로드되었는지 확인
                                    if not os.path.exists(video_file_path) or os.path.getsize(video_file_path) == 0:
                                        raise Exception(f"Video file is empty or not downloaded: {video_file_path}")
                                    
                                    print(f"[Render] Video {idx+1} downloaded: {video_file_path} ({os.path.getsize(video_file_path) / 1024 / 1024:.2f} MB, {start_time}s - {end_time}s)")
                                    image_segments.append((video_file_path, start_time, end_time, True))
                                except Exception as video_error:
                                    print(f"[Render] Video download error: {str(video_error)}")
                                    # 영상 다운로드 실패 시 오류를 발생시켜 사용자에게 알림
                                    raise Exception(f"영상 다운로드 실패 (인덱스 {idx+1}): {str(video_error)}")
                            else:
                                # 이미지 URL인 경우 기존 로직 사용
                                img_file_path = download_image(img_url, f"{temp_dir}/image_{idx}")
                                image_segments.append((img_file_path, start_time, end_time, False))
                                print(f"[Render] Auto image {idx+1} saved: {img_file_path} ({start_time}s - {end_time}s)")
                    except Exception as e:
                        print(f"[Render] Auto image/video {idx+1} processing error: {str(e)}")
                        # 오류가 나도 계속 진행
                
                print(f"[Render] Total {len(image_segments)} image/video segments prepared")
            else:
                # autoImages가 없으면 기본 이미지만 사용
                image_segments = [(img_path, 0, duration if duration > 0 else 999)]
                print(f"[Render] No autoImages, using background image only")
            
            # 3. FFmpeg 확인
            try:
                result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, timeout=5)
                if result.returncode != 0:
                    raise Exception("FFmpeg가 설치되지 않았습니다")
                print(f"[Render] FFmpeg 확인 완료")
            except Exception as e:
                print(f"[Render] FFmpeg 확인 오류: {str(e)}")
                raise Exception(f"FFmpeg 확인 실패: {str(e)}")
            
            # 4. 파일 존재 확인
            if not os.path.exists(img_path):
                raise Exception(f"이미지 파일이 존재하지 않습니다: {img_path}")
            if not os.path.exists(audio_path):
                raise Exception(f"오디오 파일이 존재하지 않습니다: {audio_path}")
            
            img_size = os.path.getsize(img_path)
            audio_size = os.path.getsize(audio_path)
            print(f"[Render] Files check - Image: {img_size} bytes, Audio: {audio_size} bytes")
            
            # 5. 한글 폰트 파일 경로 찾기 (MoviePy TextClip용)
            import glob
            font_path = None
            # 가능한 폰트 경로들 (Bold 우선)
            possible_font_paths = [
                "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
                "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
                "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
                "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            ]
            
            # 폰트 파일 찾기
            for path in possible_font_paths:
                if os.path.exists(path):
                    font_path = path
                    break
            
            # 폰트를 찾지 못한 경우 glob으로 검색 (Bold 우선)
            if not font_path:
                for pattern in [
                    "/usr/share/fonts/**/NotoSansCJK*Bold*.ttc",
                    "/usr/share/fonts/**/NotoSansCJK*Bold*.ttf",
                    "/usr/share/fonts/**/NotoSansCJK*.ttc",
                    "/usr/share/fonts/**/NotoSansCJK*.ttf",
                    "/usr/share/fonts/**/*CJK*.ttc",
                    "/usr/share/fonts/**/*CJK*.ttf",
                ]:
                    found = glob.glob(pattern, recursive=True)
                    if found:
                        font_path = found[0]
                        break
            
            print(f"[Render] Font path: {font_path if font_path else 'Not found, using default'}")
            
            # 6. FFmpeg-python으로 영상 렌더링 (여러 이미지 전환 지원)
            output_path = f"{temp_dir}/output.mp4"
            
            print(f"[Render] FFmpeg-python rendering started...")
            print(f"[Render] Image segments: {len(image_segments)}")
            print(f"[Render] Audio path: {audio_path}")
            print(f"[Render] Output path: {output_path}")
            print(f"[Render] Subtitles: {len(subtitles) if subtitles else 0} subtitles")
            
            try:
                # 여러 이미지가 있는 경우 각 세그먼트를 별도로 렌더링 후 concat
                if len(image_segments) > 1:
                    print(f"[Render] Processing {len(image_segments)} image segments...")
                    
                    # 실제 오디오 길이에 맞춰 마지막 세그먼트의 end_time 조정
                    if actual_audio_duration > 0:
                        # 마지막 세그먼트의 end_time을 actual_audio_duration으로 조정
                        last_segment = image_segments[-1]
                        if last_segment[2] < actual_audio_duration:
                            image_segments[-1] = (last_segment[0], last_segment[1], actual_audio_duration)
                            print(f"[Render] 마지막 세그먼트 end_time 조정: {last_segment[2]:.2f}s -> {actual_audio_duration:.2f}s")
                    
                    segment_files = []
                    accumulated_time = 0.0  # 누적 시간 추적 (누적 오차 방지)
                    
                    for idx, segment_data in enumerate(image_segments):
                        # segment_data는 (img_file, seg_start_time, seg_end_time, is_video) 또는 (img_file, seg_start_time, seg_end_time)
                        if len(segment_data) == 4:
                            img_file, seg_start_time, seg_end_time, is_video = segment_data
                        else:
                            img_file, seg_start_time, seg_end_time = segment_data
                            is_video = False
                        
                        segment_duration = seg_end_time - seg_start_time
                        if segment_duration <= 0:
                            continue
                        
                        # 마지막 세그먼트인지 확인
                        is_last_segment = (idx == len(image_segments) - 1)
                        
                        segment_output = f"{temp_dir}/segment_{idx}.mp4"
                        print(f"[Render] Processing segment {idx}: {img_file} ({segment_duration:.2f}s, is_video={is_video}, is_last={is_last_segment})")
                        
                        # 단순화: 미리보기에서 보낸 자막 시간을 그대로 사용
                        seg_start_time_precise = round(seg_start_time, 6)
                        segment_duration_precise = round(segment_duration, 6)
                        
                        # 이 세그먼트에 해당하는 자막 필터 생성 (미리보기에서 보낸 시간 그대로 사용)
                        segment_subtitle_filters = []
                        if show_subtitles and subtitles and len(subtitles) > 0:
                            last_subtitle_index = len(subtitles) - 1
                            
                            for sub_idx, sub in enumerate(subtitles):
                                # 미리보기에서 보낸 정확한 시간 그대로 사용
                                sub_start = float(sub.get('start', sub.get('startTime', 0)))
                                sub_end = float(sub.get('end', sub.get('endTime', sub_start + 2)))
                                
                                # 마지막 자막인 경우, 실제 오디오 길이 + 3초 여유에 맞춰 endTime 조정
                                is_last_subtitle = (sub_idx == last_subtitle_index)
                                if is_last_segment and is_last_subtitle and actual_audio_duration > 0:
                                    target_end_time = actual_audio_duration + 3
                                    if sub_end < target_end_time:
                                        sub_end = target_end_time
                                
                                # 자막이 세그먼트 범위와 겹치면 포함
                                if sub_end < seg_start_time or sub_start > seg_end_time:
                                    continue
                                
                                # 단순히 세그먼트 시작 시간을 빼서 상대 시간으로 변환 (복잡한 보정 없음)
                                adjusted_start = sub_start - seg_start_time
                                adjusted_end = sub_end - seg_start_time
                                
                                # 세그먼트 범위 내로 제한
                                adjusted_start = max(0.0, adjusted_start)
                                adjusted_end = min(segment_duration_precise, adjusted_end)
                                
                                # 유효한 시간 범위인지 확인
                                if adjusted_end <= adjusted_start or adjusted_end - adjusted_start < 0.001:
                                    continue
                                
                                text = sub.get('text', '').strip()
                                if not text:
                                    continue
                                
                                # 텍스트 이스케이프 (FFmpeg drawtext용)
                                text_escaped = text.replace('\\', '\\\\').replace(':', '\\:').replace("'", "\\'").replace('[', '\\[').replace(']', '\\]')
                                
                                # drawtext 필터 파라미터 저장 (소수점 6자리까지 정확하게)
                                segment_subtitle_filters.append({
                                    'text': text_escaped,
                                    'start': round(adjusted_start, 6),
                                    'end': round(adjusted_end, 6)
                                })
                        
                        # FFmpeg-python으로 세그먼트 렌더링
                        if is_video:
                            # 영상인 경우 영상 파일을 입력으로 사용 (반복 재생)
                            # stream_loop=-1: 무한 반복, t=segment_duration: 세그먼트 길이만큼만 재생
                            input_video = ffmpeg.input(img_file, stream_loop=-1, t=segment_duration)
                            # 영상 크기 조정
                            stream = input_video.video.filter('scale', 1920, 1080, force_original_aspect_ratio='decrease')
                            stream = stream.filter('pad', 1920, 1080, '(ow-iw)/2', '(oh-ih)/2', color='black')
                        else:
                            # 이미지인 경우 기존 로직 사용
                            input_video = ffmpeg.input(img_file, loop=1, framerate=1, t=segment_duration)
                            # 기본 필터: 이미지 크기 조정
                            stream = input_video.video.filter('scale', 1920, 1080, force_original_aspect_ratio='decrease')
                            stream = stream.filter('pad', 1920, 1080, '(ow-iw)/2', '(oh-ih)/2', color='black')
                        
                        # 자막 필터 추가 (한 줄, 큰 글씨) - show_subtitles가 True일 때만
                        if show_subtitles:
                            for sub_info in segment_subtitle_filters:
                                # 텍스트를 한 줄로 강제 (줄바꿈 제거) - 이미 이스케이프된 텍스트에서 줄바꿈만 제거
                                text_for_display = sub_info['text'].replace('\n', ' ').replace('\r', ' ').replace('  ', ' ').strip()
                                
                                # 시간을 소수점 6자리까지 정확하게 지정 (미리보기와 동일한 정밀도)
                                sub_start_precise = round(sub_info['start'], 6)
                                sub_end_precise = round(sub_info['end'], 6)
                                
                                drawtext_params = {
                                    'text': text_for_display,
                                    'fontsize': 80,  # 크기 증가 (60 -> 80)
                                    'fontcolor': 'white',
                                    'x': '(w-text_w)/2',
                                    'y': 'h-th-100',
                                    'box': 1,
                                    'boxcolor': 'black@0.75',
                                    'boxborderw': 10,
                                    'enable': f'between(t,{sub_start_precise:.6f},{sub_end_precise:.6f})',  # 소수점 6자리까지 정확하게
                                    'fix_bounds': 1  # 텍스트 경계 고정
                                }
                                if font_path:
                                    drawtext_params['fontfile'] = font_path
                                    print(f"[Render] 자막 폰트 사용: {font_path}")
                                else:
                                    # 폰트가 없으면 에러 발생 (네모박스 X 문제 방지)
                                    raise Exception("한글 폰트 파일을 찾을 수 없습니다. NotoSansCJK 폰트가 필요합니다.")
                                
                                try:
                                    stream = stream.filter('drawtext', **drawtext_params)
                                except Exception as e:
                                    print(f"[Render] 자막 필터 적용 오류: {str(e)}")
                                    print(f"[Render] 자막 텍스트: {text_for_display[:50]}...")
                                    raise
                        
                        # 비디오와 오디오를 함께 렌더링 (단순화: 전체 오디오에서 해당 시간 구간만 사용)
                        # 전체 오디오를 사용하고 세그먼트 시작 시간부터 해당 길이만큼만 사용
                        input_audio_whole = ffmpeg.input(audio_path, ss=seg_start_time_precise, t=segment_duration_precise)
                        
                        # 출력 설정 (비디오 + 오디오)
                        output = ffmpeg.output(
                            stream,
                            input_audio_whole.audio,
                            segment_output,
                            vcodec='libx264',
                            acodec='aac',
                            audio_bitrate='256k',
                            preset='ultrafast',  # 가장 빠른 인코딩 속도
                            crf=28,  # 품질을 약간 낮춰서 속도 향상 (23 -> 28)
                            tune='stillimage',
                            pix_fmt='yuv420p',
                            threads=0,  # 모든 CPU 코어 사용
                            shortest=None  # 오디오 길이에 맞춤
                        )
                        
                        ffmpeg.run(output, overwrite_output=True, quiet=True)
                        
                        if os.path.exists(segment_output) and os.path.getsize(segment_output) > 0:
                            segment_files.append(segment_output)
                            print(f"[Render] Segment {idx} rendered: {segment_duration_precise:.2f}s (누적 시간: {accumulated_time:.2f}s)")
                        else:
                            # 세그먼트 생성 실패 시에도 누적 시간 업데이트 (오류 방지)
                            accumulated_time += segment_duration_precise
                    
                    if len(segment_files) == 0:
                        raise Exception("No valid segments created")
                    
                    # 세그먼트 파일 목록 생성 (concat용)
                    concat_list_path = f"{temp_dir}/concat_list.txt"
                    with open(concat_list_path, 'w') as f:
                        for seg_file in segment_files:
                            f.write(f"file '{seg_file}'\n")
                    
                    # 각 세그먼트에 오디오가 이미 포함되어 있으므로 concat만 수행
                    # 오디오는 각 세그먼트에 이미 포함되어 있어서 정확한 동기화 보장
                    concat_cmd = [
                        'ffmpeg',
                        '-y',
                        '-f', 'concat',
                        '-safe', '0',
                        '-i', concat_list_path,
                        '-c', 'copy',  # 비디오와 오디오 모두 copy (재인코딩 없음, 정확한 동기화)
                        '-movflags', '+faststart',
                        output_path
                    ]
                    
                    # 각 세그먼트에 오디오가 이미 포함되어 있으므로 duration 옵션 불필요
                    # 각 세그먼트가 정확한 길이를 가지고 있어서 concat 시 자동으로 맞춰짐
                    # -t 옵션을 사용하지 않으면 각 세그먼트의 실제 길이에 맞춰 자동으로 전체 길이가 결정됨
                    print(f"[Render] Concat {len(segment_files)} segments with embedded audio")
                    print(f"[Render] Actual audio duration: {actual_audio_duration:.3f}s, Requested duration: {duration:.3f}s")
                    print(f"[Render] 각 세그먼트의 실제 길이에 맞춰 자동으로 전체 길이 결정 (duration 옵션 사용 안 함)")
                    
                    result = subprocess.run(concat_cmd, capture_output=True, text=True, timeout=3000)  # 50분
                    if result.returncode != 0:
                        raise Exception(f"Concat failed: {result.stderr}")
                    
                else:
                    # 단일 이미지
                    img_path = image_segments[0][0] if image_segments else img_path
                    print(f"[Render] Processing single image: {img_path}")
                    
                    # 자막 필터 생성 (클라이언트에서 전달한 시간대를 그대로 사용)
                    subtitle_filters = []
                    if show_subtitles and subtitles and len(subtitles) > 0:
                        last_subtitle_index = len(subtitles) - 1
                        
                        for sub_idx, sub in enumerate(subtitles):
                            text = sub.get('text', '').strip()
                            if not text:
                                continue
                            
                            # 클라이언트에서 이미 정확한 시간대로 나뉘어진 자막을 그대로 사용
                            start_time = float(sub.get('start', sub.get('startTime', 0)))
                            end_time = float(sub.get('end', sub.get('endTime', start_time + 2)))
                            
                            # 마지막 자막인 경우, 실제 오디오 길이 + 3초 여유에 맞춰 endTime 조정
                            is_last_subtitle = (sub_idx == last_subtitle_index)
                            if is_last_subtitle and actual_audio_duration > 0:
                                target_end_time = actual_audio_duration + 3
                                if end_time < target_end_time:
                                    end_time = target_end_time
                            
                            # 텍스트 이스케이프 (FFmpeg drawtext용)
                            text_escaped = text.replace('\\', '\\\\').replace(':', '\\:').replace("'", "\\'").replace('[', '\\[').replace(']', '\\]')
                            
                            subtitle_filters.append({
                                'text': text_escaped,
                                'start': start_time,
                                'end': end_time
                            })
                    
                    # FFmpeg-python으로 렌더링
                    # img_path가 영상 파일인지 확인 (확장자로 판단)
                    is_background_video = img_path.endswith('.mp4') or img_path.endswith('.mov') or img_path.endswith('.avi') or 'background_video' in img_path
                    if is_background_video:
                        # 영상인 경우 반복 재생
                        input_video = ffmpeg.input(img_path, stream_loop=-1, t=actual_audio_duration)
                    else:
                        # 이미지인 경우 반복 재생
                        input_video = ffmpeg.input(img_path, loop=1, framerate=1)
                    input_audio = ffmpeg.input(audio_path)
                    
                    # 기본 필터
                    stream = input_video.video.filter('scale', 1920, 1080, force_original_aspect_ratio='decrease')
                    stream = stream.filter('pad', 1920, 1080, '(ow-iw)/2', '(oh-ih)/2', color='black')
                    
                    # 자막 필터 추가 (한 줄, 큰 글씨) - show_subtitles가 True일 때만
                    if show_subtitles:
                        for sub_info in subtitle_filters:
                            # 텍스트를 한 줄로 강제 (줄바꿈 제거) - 이미 이스케이프된 텍스트에서 줄바꿈만 제거
                            text_for_display = sub_info['text'].replace('\n', ' ').replace('\r', ' ').replace('  ', ' ').strip()
                            
                            drawtext_params = {
                                'text': text_for_display,
                                'fontsize': 80,  # 크기 증가 (60 -> 80)
                                'fontcolor': 'white',
                                'x': '(w-text_w)/2',
                                'y': 'h-th-100',
                                'box': 1,
                                'boxcolor': 'black@0.75',
                                'boxborderw': 10,
                                'enable': f'between(t,{sub_info["start"]},{sub_info["end"]})',
                                'fix_bounds': 1  # 텍스트 경계 고정
                            }
                            if font_path:
                                drawtext_params['fontfile'] = font_path
                                print(f"[Render] 자막 폰트 사용: {font_path}")
                            else:
                                # 폰트가 없으면 에러 발생 (네모박스 X 문제 방지)
                                raise Exception("한글 폰트 파일을 찾을 수 없습니다. NotoSansCJK 폰트가 필요합니다.")
                            
                            try:
                                stream = stream.filter('drawtext', **drawtext_params)
                            except Exception as e:
                                print(f"[Render] 자막 필터 적용 오류: {str(e)}")
                                print(f"[Render] 자막 텍스트: {sub_info['text'][:50]}...")
                                raise
                    
                    # 출력 설정
                    audio_codec_str = 'aac' if audio_codec and audio_codec.lower() not in ['aac', 'mp3'] else 'copy'
                    
                    # 실제 오디오 길이를 사용하여 영상 길이 결정
                    video_duration = actual_audio_duration if actual_audio_duration > 0 else (duration if duration > 0 else None)
                    
                    # 출력 설정 (duration이 있으면 t 옵션 포함)
                    output_kwargs = {
                        'vcodec': 'libx264',
                        'preset': 'ultrafast',  # 가장 빠른 인코딩 속도
                        'crf': 28,  # 품질을 약간 낮춰서 속도 향상 (23 -> 28)
                        'tune': 'stillimage',
                        'pix_fmt': 'yuv420p',
                        'threads': 0,  # 모든 CPU 코어 사용
                        'acodec': audio_codec_str,
                        'movflags': '+faststart'
                    }
                    
                    # duration이 있으면 t 옵션 추가
                    if video_duration and video_duration > 0:
                        output_kwargs['t'] = video_duration
                        print(f"[Render] Using video duration: {video_duration:.3f}s (actual_audio: {actual_audio_duration:.3f}s, requested: {duration:.3f}s)")
                    
                    output = ffmpeg.output(
                        stream,
                        input_audio,
                        output_path,
                        **output_kwargs
                    )
                    
                    ffmpeg.run(output, overwrite_output=True, quiet=True)
                
                print(f"[Render] FFmpeg-python rendering completed")
                
            except Exception as e:
                error_trace = traceback.format_exc()
                print(f"[Render] FFmpeg-python rendering error: {error_trace}")
                raise Exception(f"FFmpeg-python rendering failed: {str(e)}")
            
            # 6. 렌더링된 영상 읽기
            if not os.path.exists(output_path):
                raise Exception("렌더링된 영상 파일이 생성되지 않았습니다")
            
            with open(output_path, 'rb') as f:
                video_data = f.read()
            
            if len(video_data) == 0:
                raise Exception("렌더링된 영상 파일이 비어있습니다")
            
            video_size_mb = len(video_data) / 1024 / 1024
            print(f"[Render] Video read: {video_size_mb:.2f} MB")
            
            # 7. Cloud Storage에 업로드 또는 base64로 반환
            # Cloud Run 응답 크기 제한(32MB)을 고려하여 처리
            # 환경 변수 읽기 (여러 방법 시도)
            project_id = (
                os.environ.get('GOOGLE_CLOUD_PROJECT_ID') or 
                os.environ.get('GCP_PROJECT') or
                'test-ai-450613'  # 기본값
            )
            bucket_name = (
                os.environ.get('GOOGLE_CLOUD_STORAGE_BUCKET') or
                'video-renderer-storage'  # 기본값
            )
            
            # 환경 변수 디버깅
            print(f"[Render] Environment variables check:")
            print(f"[Render] GOOGLE_CLOUD_PROJECT_ID: {project_id}")
            print(f"[Render] GOOGLE_CLOUD_STORAGE_BUCKET: {bucket_name}")
            print(f"[Render] All env vars with GOOGLE/GCP: {[k for k in os.environ.keys() if 'GOOGLE' in k or 'GCP' in k]}")
            
            # base64 인코딩 후 크기 예상 (원본 크기의 약 1.33배)
            estimated_base64_size = len(video_data) * 1.33
            estimated_base64_size_mb = estimated_base64_size / 1024 / 1024
            
            # 비디오가 8MB 이상이거나 base64 인코딩 후 30MB를 초과하면 GCS 사용 필수
            requires_gcs = (video_size_mb > 8) or (estimated_base64_size_mb > 30)
            
            # 디버깅 로그
            print(f"[Render] Video size: {video_size_mb:.2f} MB, Estimated base64: {estimated_base64_size_mb:.2f} MB")
            print(f"[Render] Requires GCS: {requires_gcs}")
            print(f"[Render] GCS configured: bucket={bool(bucket_name)}, project={bool(project_id)}")
            
            if requires_gcs:
                # GCS가 필수인 경우, 설정이 없으면 에러
                if not (project_id and bucket_name):
                    print(f"[Render] ERROR: GCS environment variables not set!")
                    print(f"[Render] All environment variables: {dict(os.environ)}")
                    raise Exception(
                        f"비디오 파일이 너무 큽니다 ({video_size_mb:.2f} MB, base64 예상: {estimated_base64_size_mb:.2f} MB). "
                        f"Cloud Storage를 설정해주세요. (GOOGLE_CLOUD_STORAGE_BUCKET, GOOGLE_CLOUD_PROJECT_ID 환경 변수 필요)"
                    )
                
                # GCS 업로드 시도
                try:
                    from google.cloud import storage
                    
                    print(f"[Render] Uploading video to Cloud Storage (size: {video_size_mb:.2f} MB)...")
                    storage_client = storage.Client(project=project_id)
                    bucket = storage_client.bucket(bucket_name)
                    
                    # 고유한 파일명 생성 (타임스탬프 + UUID로 충돌 방지)
                    video_filename = f"rendered_video_{int(time.time())}_{unique_id}.mp4"
                    blob = bucket.blob(video_filename)
                    blob.upload_from_string(video_data, content_type='video/mp4')
                    
                    # 공개 URL 사용 (버킷 IAM 정책에서 allUsers에게 objectViewer 권한이 이미 설정되어 있음)
                    # 버킷 레벨에서 공개 접근이 허용되어 있으므로 public_url 사용 가능
                    video_url = blob.public_url
                    print(f"[Render] Video uploaded to GCS: {video_url}")
                    
                    print(f"[Render] Video uploaded to GCS: {video_url}")
                    
                    return {
                        'success': True,
                        'videoUrl': video_url,
                        'videoBase64': None,
                        'downloadUrl': video_url,
                        'projectId': f"project_{int(time.time())}_{unique_id}",
                        'error': None,
                        'details': None
                    }
                except Exception as gcs_error:
                    error_msg = str(gcs_error)
                    print(f"[Render] GCS 업로드 실패: {error_msg}")
                    raise Exception(
                        f"비디오 파일이 너무 큽니다 ({video_size_mb:.2f} MB). Cloud Storage 업로드에 실패했습니다: {error_msg}"
                    )
            
            # base64로 인코딩하여 반환 (작은 파일인 경우만)
            video_base64 = base64.b64encode(video_data).decode('utf-8')
            base64_size_mb = len(video_base64) / 1024 / 1024
            print(f"[Render] Base64 encoded: {base64_size_mb:.2f} MB")
            
            if base64_size_mb > 30:
                raise Exception(
                    f"비디오 파일이 너무 큽니다 (base64: {base64_size_mb:.2f} MB). "
                    f"Cloud Storage를 설정해주세요. (GOOGLE_CLOUD_STORAGE_BUCKET, GOOGLE_CLOUD_PROJECT_ID 환경 변수 필요)"
                )
            
            # 결과 반환
            return {
                'success': True,
                'videoUrl': None,
                'videoBase64': video_base64,
                'downloadUrl': None,
                'projectId': f"project_{int(time.time())}_{unique_id}",
                'error': None,
                'details': None
            }
            
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"[Render] execute_render_logic 오류: {str(e)}\n{error_trace}")
        return {
            'success': False,
            'videoUrl': None,
            'videoBase64': None,
            'downloadUrl': None,
            'projectId': None,
            'error': str(e),
            'details': error_trace[:500] if len(error_trace) > 500 else error_trace
        }
    finally:
        # 임시 파일 정리
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
                print(f"[Render] Temp files cleaned up")
            except Exception as e:
                print(f"[Render] 임시 파일 정리 오류: {str(e)}")
        
@app.route('/status/<job_id>', methods=['GET', 'OPTIONS'])
def get_job_status(job_id):
    """작업 상태 확인 엔드포인트"""
    if request.method == 'OPTIONS':
        response = jsonify({})
        return add_cors_headers(response), 200
    
    if job_id not in job_status:
        return jsonify({
            "success": False,
            "error": f"작업을 찾을 수 없습니다: {job_id}"
        }), 404
    
    status = job_status[job_id]
    
    return jsonify({
        "success": True,
        "jobId": job_id,
        "status": status.get('status', 'unknown'),
        "progress": status.get('progress', 0),
        "videoUrl": status.get('videoUrl'),
        "downloadUrl": status.get('downloadUrl'),
        "videoBase64": status.get('videoBase64'),
        "error": status.get('error'),
        "message": status.get('message', ''),
    }), 200

@app.route('/', methods=['GET'])
def health_check():
    """헬스 체크"""
    return jsonify({
        "status": "running",
        "service": "video-renderer",
        "endpoints": {
            "render": "POST /render",
            "status": "GET /status/<job_id>"
        }
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
