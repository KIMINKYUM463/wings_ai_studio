"""
Cloud Run 영상 렌더링 서비스
간단한 버전 - 먼저 동작 확인용
"""

from flask import Flask, request, jsonify
import os
import sys
import datetime

app = Flask(__name__)
# Cloud Run의 요청 크기 제한은 32MB이지만, Flask 앱 레벨에서도 제한 설정
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32MB

@app.route('/render', methods=['POST'])
def render_video():
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
        
        # 요청 데이터 확인
        audio_base64 = data.get('audioBase64')
        audio_gcs_url = data.get('audioGcsUrl')  # Cloud Storage URL
        subtitles = data.get('subtitles', [])
        character_image = data.get('characterImage')
        auto_images = data.get('autoImages', [])  # 여러 이미지 배열
        duration = data.get('duration', 0)
        title = data.get('title', '')  # 쇼츠 제목
        config = data.get('config', {})
        
        # 비디오 해상도 설정 (기본값: 16:9)
        video_width = config.get('width', 1920)
        video_height = config.get('height', 1080)
        fps = config.get('fps', 30)
        is_shorts = config.get('isShorts', False)  # 쇼츠 모드 여부
        
        if not audio_base64 and not audio_gcs_url:
            return jsonify({
                "success": False,
                "error": "audioBase64 또는 audioGcsUrl이 필요합니다."
            }), 400
        
        print(f"[Render] Request received - duration: {duration}s, subtitles: {len(subtitles)}, autoImages: {len(auto_images)}")
        if audio_gcs_url:
            print(f"[Render] Using Cloud Storage URL: {audio_gcs_url}")
        elif audio_base64:
            print(f"[Render] Using base64 audio (size: {len(audio_base64) / 1024:.2f} KB)")
        else:
            print(f"[Render] No audio data provided")
        
        # 실제 영상 렌더링 로직 구현
        import subprocess
        import tempfile
        import base64
        import time
        import requests
        import shutil
        import traceback
        
        temp_dir = None
        try:
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
                    print(f"[Render] Downloading audio from Cloud Storage: {audio_gcs_url}")
                    audio_response = requests.get(audio_gcs_url, timeout=300, headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    })
                    audio_response.raise_for_status()
                    audio_data = audio_response.content
                    print(f"[Render] Audio downloaded from GCS: {len(audio_data) / 1024 / 1024:.2f} MB")
                    print(f"[Render] Audio Content-Type: {audio_response.headers.get('Content-Type', 'unknown')}")
                    
                    # 오디오 데이터 검증
                    if len(audio_data) == 0:
                        raise Exception("다운로드된 오디오 데이터가 비어있습니다.")
                    if len(audio_data) < 100:
                        raise Exception(f"오디오 데이터가 너무 작습니다: {len(audio_data)} bytes")
                else:
                    # base64 디코딩
                    if not audio_base64:
                        raise Exception("audio_base64 또는 audio_gcs_url이 필요합니다.")
                    audio_data = base64.b64decode(audio_base64)
                    print(f"[Render] Audio decoded from base64: {len(audio_data) / 1024 / 1024:.2f} MB")
                
                # 오디오 형식 자동 감지 (WAV 또는 MP3)
                # FFmpeg가 자동으로 형식을 감지하므로 확장자는 중요하지 않음
                audio_path = f"{temp_dir}/audio.wav"
                with open(audio_path, 'wb') as f:
                    f.write(audio_data)
                print(f"[Render] Audio saved to {audio_path}: {len(audio_data) / 1024 / 1024:.2f} MB")
                
                # 파일이 제대로 저장되었는지 확인
                if not os.path.exists(audio_path):
                    raise Exception(f"오디오 파일 저장 실패: {audio_path}")
                saved_size = os.path.getsize(audio_path)
                if saved_size != len(audio_data):
                    raise Exception(f"오디오 파일 크기 불일치: 저장된 크기 {saved_size} != 원본 크기 {len(audio_data)}")
                print(f"[Render] Audio file verified: {saved_size} bytes")
                
                # 실제 오디오 길이 측정 (ffprobe 사용)
                try:
                    import json
                    probe_cmd = [
                        'ffprobe',
                        '-v', 'quiet',
                        '-print_format', 'json',
                        '-show_format',
                        audio_path
                    ]
                    probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=30)
                    if probe_result.returncode == 0:
                        probe_data = json.loads(probe_result.stdout)
                        actual_audio_duration = float(probe_data.get('format', {}).get('duration', 0))
                        print(f"[Render] Actual audio duration: {actual_audio_duration:.3f}s (requested: {duration}s)")
                        
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
                """이미지를 다운로드하여 저장하는 헬퍼 함수"""
                if img_url.startswith("data:"):
                    # data URL 처리
                    if "," in img_url:
                        header, b64data = img_url.split(",", 1)
                        if "image/png" in header:
                            img_ext = "png"
                        elif "image/jpeg" in header or "image/jpg" in header:
                            img_ext = "jpg"
                        elif "image/webp" in header:
                            img_ext = "webp"
                        else:
                            img_ext = "png"
                    else:
                        b64data = img_url
                        img_ext = "png"
                    
                    img_data = base64.b64decode(b64data)
                    full_path = f"{output_path}.{img_ext}"
                    with open(full_path, 'wb') as f:
                        f.write(img_data)
                    return full_path
                else:
                    # HTTP/HTTPS URL 처리
                    img_response = requests.get(img_url, timeout=30)
                    img_response.raise_for_status()
                    
                    img_ext = 'jpg'
                    if img_url.lower().endswith('.png'):
                        img_ext = 'png'
                    elif img_url.lower().endswith('.webp'):
                        img_ext = 'webp'
                    
                    full_path = f"{output_path}.{img_ext}"
                    with open(full_path, 'wb') as f:
                        f.write(img_response.content)
                    return full_path
            
            # 기본 배경 이미지 (character_image)
            try:
                print(f"[Render] Processing background image: {character_image[:50]}...")
                img_path = download_image(character_image, f"{temp_dir}/background")
                print(f"[Render] Background image saved: {img_path}")
            except Exception as e:
                print(f"[Render] Background image processing error: {str(e)}")
                raise Exception(f"Background image processing failed: {str(e)}")
            
            # autoImages 처리 (여러 이미지 다운로드)
            image_segments = []  # [(image_path, start_time, end_time), ...]
            
            if auto_images and len(auto_images) > 0:
                print(f"[Render] Processing {len(auto_images)} auto images...")
                for idx, auto_img in enumerate(auto_images):
                    try:
                        img_url = auto_img.get('url', '')
                        start_time = float(auto_img.get('startTime', 0))
                        end_time = float(auto_img.get('endTime', start_time + 1))
                        
                        if img_url:
                            img_file_path = download_image(img_url, f"{temp_dir}/image_{idx}")
                            image_segments.append((img_file_path, start_time, end_time))
                            print(f"[Render] Auto image {idx+1} saved: {img_file_path} ({start_time}s - {end_time}s)")
                    except Exception as e:
                        print(f"[Render] Auto image {idx+1} processing error: {str(e)}")
                        # 오류가 나도 계속 진행
                
                print(f"[Render] Total {len(image_segments)} image segments prepared")
            else:
                # autoImages가 없으면 기본 이미지만 사용
                image_segments = [(img_path, 0, duration if duration > 0 else 999)]
                print(f"[Render] No autoImages, using background image only")
            
            # 3. FFmpeg 확인
            try:
                ffmpeg_check = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, timeout=5)
                if ffmpeg_check.returncode != 0:
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
            
            # 5. 자막 필터 생성 (미리보기와 동일하게)
            subtitle_filters = []
            if subtitles and len(subtitles) > 0:
                print(f"[Render] Processing {len(subtitles)} subtitles...")
                # 각 자막에 대해 drawtext 필터 생성
                for idx, sub in enumerate(subtitles):
                    # 자막 데이터 형식: {id, text, start, end} (미리보기와 동일)
                    text = sub.get('text', '')
                    # 클라이언트에서 계산한 정확한 타이밍을 그대로 사용 (조정하지 않음)
                    start_time = float(sub.get('start', sub.get('startTime', 0)))
                    end_time = float(sub.get('end', sub.get('endTime', start_time + 2)))
                    
                    # 미리보기 스타일과 동일하게 설정
                    # fontSize: 60, font: bold, color: white, 배경: rgba(0, 0, 0, 0.75)
                    # 위치: 중앙 하단 (canvas.width / 2, canvas.height - totalHeight - 100)
                    # padding: 40, lineHeight: 80
                    font_size = 60  # 미리보기와 동일
                    color = 'white'  # 미리보기와 동일
                    
                    if not text or not text.strip():
                        continue
                    
                    # FFmpeg drawtext 필터
                    # 텍스트 이스케이프 (특수문자 처리)
                    text_escaped = text.replace('\\', '\\\\').replace(':', '\\:').replace("'", "\\'").replace('[', '\\[').replace(']', '\\]')
                    
                    # 위치 설정 (쇼츠 모드와 일반 모드 구분)
                    if is_shorts:
                        # 쇼츠 모드: 아래쪽 자막 영역 (하단에서 150px 위)
                        x_pixel = "(w-text_w)/2"  # 중앙 정렬
                        y_pixel = "h-th-150"  # 하단에서 텍스트 높이 + 150px 위
                    else:
                        # 일반 모드: 중앙 하단
                        x_pixel = "(w-text_w)/2"  # 중앙 정렬
                        y_pixel = "h-th-100"  # 하단에서 텍스트 높이 + 100px 위
                    
                    # 한글 폰트 파일 경로 찾기 (Bold 우선)
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
                    
                    # drawtext 필터 생성 (미리보기와 동일한 스타일)
                    # 미리보기: fontSize=60, bold, white, 배경 rgba(0,0,0,0.75), 중앙 하단
                    # 한글 지원을 위해 폰트 파일 지정
                    drawtext_params = [
                        f"text='{text_escaped}'",
                        f"x={x_pixel}",
                        f"y={y_pixel}",
                        f"fontsize={font_size}",
                        f"fontcolor={color}",
                        f"enable='between(t,{start_time},{end_time})'",
                        f"box=1:boxcolor=black@0.75:boxborderw=10",  # rgba(0,0,0,0.75)와 동일
                        f"text_align=center"
                    ]
                    
                    # 폰트 파일이 있으면 추가 (Bold 폰트 우선)
                    if font_path:
                        drawtext_params.insert(1, f"fontfile={font_path}")
                    
                    drawtext_filter = "drawtext=" + ":".join(drawtext_params)
                    subtitle_filters.append(drawtext_filter)
                    print(f"[Render] Subtitle {idx+1}: '{text[:30]}...' ({start_time}s - {end_time}s)")
            
            # 6. FFmpeg로 영상 렌더링 (여러 이미지 전환 지원)
            output_path = f"{temp_dir}/output.mp4"
            
            print(f"[Render] FFmpeg rendering started...")
            print(f"[Render] Image segments: {len(image_segments)}")
            print(f"[Render] Audio path: {audio_path}")
            print(f"[Render] Output path: {output_path}")
            print(f"[Render] Subtitles: {len(subtitle_filters)} filters")
            
            # 여러 이미지가 있는 경우 concat 필터 사용
            if len(image_segments) > 1:
                print(f"[Render] Using concat filter for {len(image_segments)} images...")
                
                # 각 이미지 세그먼트를 별도 파일로 렌더링
                segment_files = []
                for idx, (img_file, start_time, end_time) in enumerate(image_segments):
                    segment_duration = end_time - start_time
                    if segment_duration <= 0:
                        continue
                    
                    segment_output = f"{temp_dir}/segment_{idx}.mp4"
                    
                    # 각 세그먼트의 자막 필터 (해당 시간대의 자막만)
                    # 자막 시간을 세그먼트 시작 시간 기준으로 조정
                    segment_subtitle_filters = []
                    for sub_filter in subtitle_filters:
                        # 자막 필터에서 시간 범위 추출
                        # enable='between(t,start,end)' 형식에서 start, end 추출
                        import re
                        time_match = re.search(r"between\(t,([\d.]+),([\d.]+)\)", sub_filter)
                        if time_match:
                            sub_start = float(time_match.group(1))
                            sub_end = float(time_match.group(2))
                            # 자막이 이 세그먼트 시간 범위와 겹치면 포함
                            if not (sub_end < start_time or sub_start > end_time):
                                # 세그먼트 시작 시간 기준으로 자막 시간 조정
                                adjusted_sub_filter = sub_filter.replace(
                                    f"between(t,{sub_start},{sub_end})",
                                    f"between(t,{max(0, sub_start - start_time)},{min(segment_duration, sub_end - start_time)})"
                                )
                                segment_subtitle_filters.append(adjusted_sub_filter)
                    
                    # 세그먼트 필터
                    if is_shorts:
                        # 쇼츠 모드: 위 제목, 가운데 1:1 이미지, 아래 자막
                        image_size = int(min(video_width * 0.7, video_height * 0.5))
                        image_scale = f'scale={image_size}:{image_size}:force_original_aspect_ratio=increase,crop={image_size}:{image_size}'
                        image_y = (video_height - image_size) // 2
                        
                        # 필터 체인 구성
                        filter_parts = []
                        # 1. 이미지 리사이즈 및 크롭
                        filter_parts.append(f'[0:v]{image_scale}[img]')
                        # 2. 검은 배경 생성
                        filter_parts.append(f'color=c=black:s={video_width}x{video_height}:d={segment_duration}[bg]')
                        # 3. 이미지를 배경 위에 오버레이 (가운데)
                        filter_parts.append(f'[bg][img]overlay=(W-w)/2:{image_y}[v1]')
                        
                        # 4. 제목 추가 (위쪽 고정)
                        if title:
                            title_escaped = title.replace('\\', '\\\\').replace(':', '\\:').replace("'", "\\'").replace('[', '\\[').replace(']', '\\]')
                            # 폰트 파일 찾기
                            import glob
                            font_path = None
                            for path in ["/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"]:
                                if os.path.exists(path):
                                    font_path = path
                                    break
                            if not font_path:
                                for pattern in ["/usr/share/fonts/**/NotoSansCJK*Bold*.ttc", "/usr/share/fonts/**/NotoSansCJK*.ttc"]:
                                    found = glob.glob(pattern, recursive=True)
                                    if found:
                                        font_path = found[0]
                                        break
                            
                            font_param = f"fontfile={font_path}:" if font_path else ""
                            filter_parts.append(f"[v1]drawtext={font_param}text='{title_escaped}':x=(w-text_w)/2:y=50:fontsize=48:fontcolor=yellow:box=1:boxcolor=black@0.8:boxborderw=5[v2]")
                        else:
                            filter_parts.append("[v1]null[v2]")
                        
                        # 5. 자막 추가
                        if segment_subtitle_filters:
                            current_label = "[v2]"
                            for i, sub_filter in enumerate(segment_subtitle_filters):
                                if i == len(segment_subtitle_filters) - 1:
                                    # 마지막 자막
                                    filter_parts.append(f"{current_label}{sub_filter}[v]")
                                else:
                                    # 중간 자막
                                    next_label = f"[v_sub{i}]"
                                    filter_parts.append(f"{current_label}{sub_filter}{next_label}")
                                    current_label = next_label
                        else:
                            filter_parts.append("[v2]null[v]")
                        
                        vf_segment = ",".join(filter_parts)
                        
                        segment_cmd = [
                            'ffmpeg',
                            '-y',
                            '-loop', '1',
                            '-framerate', str(fps),
                            '-i', img_file,
                            '-f', 'lavfi',
                            '-i', f'color=c=black:s={video_width}x{video_height}:d={segment_duration}',
                            '-c:v', 'libx264',
                            '-preset', 'veryfast',
                            '-crf', '23',
                            '-tune', 'stillimage',
                            '-pix_fmt', 'yuv420p',
                            '-t', str(segment_duration),
                            '-filter_complex', vf_segment,
                            '-map', '[v]',
                            '-threads', '0',
                            segment_output
                        ]
                    else:
                        # 일반 모드
                        base_filter = f'scale={video_width}:{video_height}:force_original_aspect_ratio=decrease,pad={video_width}:{video_height}:(ow-iw)/2:(oh-ih)/2'
                        if segment_subtitle_filters:
                            vf_segment = base_filter + ',' + ','.join(segment_subtitle_filters)
                        else:
                            vf_segment = base_filter
                        
                        segment_cmd = [
                            'ffmpeg',
                            '-y',
                            '-loop', '1',
                            '-framerate', str(fps),
                            '-i', img_file,
                            '-c:v', 'libx264',
                            '-s', f'{video_width}x{video_height}',
                            '-preset', 'veryfast',
                            '-crf', '23',
                            '-tune', 'stillimage',
                            '-pix_fmt', 'yuv420p',
                            '-t', str(segment_duration),
                            '-vf', vf_segment,
                            '-threads', '0',
                            segment_output
                        ]
                    
                    result_seg = subprocess.run(segment_cmd, capture_output=True, text=True, timeout=300)
                    if result_seg.returncode != 0:
                        print(f"[Render] Segment {idx} rendering failed: {result_seg.stderr}")
                        raise Exception(f"Segment {idx} rendering failed: {result_seg.stderr[:500]}")
                    
                    if os.path.exists(segment_output) and os.path.getsize(segment_output) > 0:
                        segment_files.append(segment_output)
                        print(f"[Render] Segment {idx} rendered: {segment_duration}s ({os.path.getsize(segment_output) / 1024:.1f} KB)")
                    else:
                        print(f"[Render] Warning: Segment {idx} file not created or empty")
                
                if len(segment_files) == 0:
                    raise Exception("No valid segments created")
                
                # 세그먼트 파일 목록 생성 (concat용)
                concat_list_path = f"{temp_dir}/concat_list.txt"
                with open(concat_list_path, 'w') as f:
                    for seg_file in segment_files:
                        f.write(f"file '{seg_file}'\n")
                
                print(f"[Render] Concat list created with {len(segment_files)} segments")
                
                # 오디오와 함께 concat (Cloud Run에서 오디오 압축 처리)
                # 오디오 파일 존재 및 크기 확인
                if not os.path.exists(audio_path):
                    raise Exception(f"오디오 파일이 존재하지 않습니다: {audio_path}")
                audio_file_size = os.path.getsize(audio_path)
                print(f"[Render] Audio file size: {audio_file_size / 1024 / 1024:.2f} MB")
                
                # 오디오 파일 검증 (ffprobe로 확인)
                try:
                    probe_cmd = [
                        'ffprobe',
                        '-v', 'error',
                        '-show_entries', 'stream=codec_name,codec_type,sample_rate,channels',
                        '-of', 'json',
                        audio_path
                    ]
                    probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=10)
                    if probe_result.returncode == 0:
                        import json
                        probe_data = json.loads(probe_result.stdout)
                        audio_streams = [s for s in probe_data.get('streams', []) if s.get('codec_type') == 'audio']
                        if len(audio_streams) > 0:
                            audio_info = audio_streams[0]
                            print(f"[Render] Audio stream info: codec={audio_info.get('codec_name')}, sample_rate={audio_info.get('sample_rate')}, channels={audio_info.get('channels')}")
                        else:
                            print(f"[Render] Warning: No audio stream found in file")
                    else:
                        print(f"[Render] Warning: Could not probe audio file: {probe_result.stderr}")
                except Exception as probe_error:
                    print(f"[Render] Warning: Audio probe failed: {str(probe_error)}")
                
                print(f"[Render] FFmpeg command: concat video + audio")
                ffmpeg_cmd = [
                    'ffmpeg',
                    '-y',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', concat_list_path,
                    '-i', audio_path,
                    '-c:v', 'copy',  # 비디오는 재인코딩 없이 복사 (속도 향상)
                    '-c:a', 'aac',
                    '-b:a', '128k',  # 오디오 비트레이트
                    '-ar', '44100',  # 샘플레이트
                    '-ac', '2',  # 스테레오 (모노인 경우 자동 변환)
                    '-map', '0:v:0',  # 비디오 스트림 명시적으로 매핑
                    '-map', '1:a:0',  # 오디오 스트림 명시적으로 매핑
                    '-shortest',  # 비디오와 오디오 중 짧은 것에 맞춤
                    '-movflags', '+faststart',
                    '-threads', '0',  # 모든 CPU 코어 사용
                    output_path
                ]
                
                if duration and duration > 0:
                    # duration이 지정되면 오디오 길이 확인
                    ffmpeg_cmd.insert(-1, '-t')
                    ffmpeg_cmd.insert(-1, str(duration))
                
            else:
                # 단일 이미지
                img_path = image_segments[0][0] if image_segments else img_path
                
                if is_shorts:
                    # 쇼츠 모드: 위 제목, 가운데 1:1 이미지, 아래 자막
                    image_size = int(min(video_width * 0.7, video_height * 0.5))
                    image_scale = f'scale={image_size}:{image_size}:force_original_aspect_ratio=increase,crop={image_size}:{image_size}'
                    image_y = (video_height - image_size) // 2
                    
                    filters = []
                    filters.append(f'[0:v]{image_scale}[img]')
                    filters.append(f'color=c=black:s={video_width}x{video_height}[bg]')
                    filters.append(f'[bg][img]overlay=(W-w)/2:{image_y}[v1]')
                    
                    # 제목 추가
                    if title:
                        title_escaped = title.replace('\\', '\\\\').replace(':', '\\:').replace("'", "\\'")
                        import glob
                        font_path = None
                        for path in ["/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"]:
                            if os.path.exists(path):
                                font_path = path
                                break
                        if not font_path:
                            for pattern in ["/usr/share/fonts/**/NotoSansCJK*Bold*.ttc"]:
                                found = glob.glob(pattern, recursive=True)
                                if found:
                                    font_path = found[0]
                                    break
                        font_param = f"fontfile={font_path}:" if font_path else ""
                        filters.append(f"[v1]drawtext={font_param}text='{title_escaped}':x=(w-text_w)/2:y=50:fontsize=48:fontcolor=yellow:box=1:boxcolor=black@0.8:boxborderw=5[v2]")
                    else:
                        filters.append("[v1]null[v2]")
                    
                    # 자막 추가
                    if subtitle_filters:
                        current_label = "[v2]"
                        for i, sub_filter in enumerate(subtitle_filters):
                            if i == len(subtitle_filters) - 1:
                                # 마지막 자막
                                filters.append(f"{current_label}{sub_filter}[v]")
                            else:
                                # 중간 자막
                                next_label = f"[v_sub{i}]"
                                filters.append(f"{current_label}{sub_filter}{next_label}")
                                current_label = next_label
                        vf_complex = ",".join(filters)
                    else:
                        vf_complex = ",".join(filters).replace("[v2]", "[v]")
                else:
                    # 일반 모드
                    base_filters = f'scale={video_width}:{video_height}:force_original_aspect_ratio=decrease,pad={video_width}:{video_height}:(ow-iw)/2:(oh-ih)/2'
                    if subtitle_filters:
                        vf_complex = base_filters + ',' + ','.join(subtitle_filters)
                    else:
                        vf_complex = base_filters
                
                # 오디오 파일 존재 및 크기 확인
                if not os.path.exists(audio_path):
                    raise Exception(f"오디오 파일이 존재하지 않습니다: {audio_path}")
                audio_file_size = os.path.getsize(audio_path)
                print(f"[Render] Audio file size: {audio_file_size / 1024 / 1024:.2f} MB")
                
                # 오디오 파일 검증 (ffprobe로 확인)
                try:
                    probe_cmd = [
                        'ffprobe',
                        '-v', 'error',
                        '-show_entries', 'stream=codec_name,codec_type,sample_rate,channels',
                        '-of', 'json',
                        audio_path
                    ]
                    probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=10)
                    if probe_result.returncode == 0:
                        import json
                        probe_data = json.loads(probe_result.stdout)
                        audio_streams = [s for s in probe_data.get('streams', []) if s.get('codec_type') == 'audio']
                        if len(audio_streams) > 0:
                            audio_info = audio_streams[0]
                            print(f"[Render] Audio stream info: codec={audio_info.get('codec_name')}, sample_rate={audio_info.get('sample_rate')}, channels={audio_info.get('channels')}")
                        else:
                            print(f"[Render] Warning: No audio stream found in file")
                    else:
                        print(f"[Render] Warning: Could not probe audio file: {probe_result.stderr}")
                except Exception as probe_error:
                    print(f"[Render] Warning: Audio probe failed: {str(probe_error)}")
                
                if is_shorts:
                    # 쇼츠 모드: 배경 + 이미지 오버레이
                    ffmpeg_cmd = [
                        'ffmpeg',
                        '-y',
                        '-loop', '1',
                        '-framerate', str(fps),
                        '-i', img_path,
                        '-f', 'lavfi',
                        '-i', f'color=c=black:s={video_width}x{video_height}',
                        '-i', audio_path,
                        '-c:v', 'libx264',
                        '-preset', 'veryfast',
                        '-crf', '23',
                        '-tune', 'stillimage',
                        '-c:a', 'aac',
                        '-b:a', '128k',
                        '-ar', '44100',
                        '-ac', '2',
                        '-pix_fmt', 'yuv420p',
                        '-shortest',
                        '-threads', '0',
                    ]
                    
                    if duration and duration > 0:
                        ffmpeg_cmd.extend(['-t', str(duration)])
                    
                    ffmpeg_cmd.extend([
                        '-filter_complex', vf_complex,
                        '-map', '[v]',
                        '-map', '2:a:0',
                        '-movflags', '+faststart',
                        output_path
                    ])
                else:
                    # 일반 모드
                    ffmpeg_cmd = [
                        'ffmpeg',
                        '-y',
                        '-loop', '1',
                        '-framerate', '1',
                        '-i', img_path,
                        '-i', audio_path,
                        '-c:v', 'libx264',
                        '-preset', 'veryfast',
                        '-crf', '23',
                        '-tune', 'stillimage',
                        '-c:a', 'aac',
                        '-b:a', '128k',
                        '-ar', '44100',
                        '-ac', '2',
                        '-map', '0:v:0',
                        '-map', '1:a:0',
                        '-pix_fmt', 'yuv420p',
                        '-shortest',
                        '-threads', '0',
                    ]
                    
                    if duration and duration > 0:
                        ffmpeg_cmd.extend(['-t', str(duration)])
                    
                    ffmpeg_cmd.extend([
                        '-movflags', '+faststart',
                        '-vf', vf_complex,
                        '-s', f'{video_width}x{video_height}',
                        output_path
                    ])
            
            print(f"[Render] FFmpeg command: {' '.join(ffmpeg_cmd)}")
            
            result = subprocess.run(
                ffmpeg_cmd, 
                capture_output=True, 
                text=True,
                timeout=900  # 15 minute timeout (for long videos)
            )
            
            # FFmpeg 출력 로깅
            if result.stdout:
                print(f"[Render] FFmpeg stdout: {result.stdout[:500]}")
            if result.stderr:
                print(f"[Render] FFmpeg stderr: {result.stderr[:1000]}")
            
            if result.returncode != 0:
                error_msg = result.stderr or result.stdout or "Unknown error"
                print(f"[Render] FFmpeg error (code: {result.returncode})")
                print(f"[Render] FFmpeg stderr: {result.stderr}")
                print(f"[Render] FFmpeg stdout: {result.stdout}")
                # 전체 오류 메시지 반환 (최대 2000자)
                full_error = f"FFmpeg stderr: {result.stderr}\nFFmpeg stdout: {result.stdout}"
                raise Exception(f"FFmpeg rendering failed: {full_error[:2000]}")
            
            print(f"[Render] FFmpeg rendering completed")
            
            # 출력 파일의 오디오 스트림 확인
            try:
                probe_cmd = [
                    'ffprobe',
                    '-v', 'error',
                    '-show_entries', 'stream=codec_name,codec_type,sample_rate,channels',
                    '-of', 'json',
                    output_path
                ]
                probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=10)
                if probe_result.returncode == 0:
                    import json
                    probe_data = json.loads(probe_result.stdout)
                    video_streams = [s for s in probe_data.get('streams', []) if s.get('codec_type') == 'video']
                    audio_streams = [s for s in probe_data.get('streams', []) if s.get('codec_type') == 'audio']
                    print(f"[Render] Output file streams: {len(video_streams)} video, {len(audio_streams)} audio")
                    if len(audio_streams) > 0:
                        audio_info = audio_streams[0]
                        print(f"[Render] Output audio stream: codec={audio_info.get('codec_name')}, sample_rate={audio_info.get('sample_rate')}, channels={audio_info.get('channels')}")
                    else:
                        print(f"[Render] ERROR: No audio stream in output file!")
                else:
                    print(f"[Render] Warning: Could not probe output file: {probe_result.stderr}")
            except Exception as probe_error:
                print(f"[Render] Warning: Output file probe failed: {str(probe_error)}")
            
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
                    
                    video_filename = f"rendered_video_{int(time.time())}.mp4"
                    blob = bucket.blob(video_filename)
                    blob.upload_from_string(video_data, content_type='video/mp4')
                    
                    # 공개 URL 사용 (버킷 IAM 정책에서 allUsers에게 objectViewer 권한이 이미 설정되어 있음)
                    # 버킷 레벨에서 공개 접근이 허용되어 있으므로 public_url 사용 가능
                    video_url = blob.public_url
                    print(f"[Render] Video uploaded to GCS: {video_url}")
                    
                    print(f"[Render] Video uploaded to GCS: {video_url}")
                    
                    return jsonify({
                        "success": True,
                        "videoUrl": video_url,
                        "projectId": f"project_{int(time.time())}"
                    })
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
            
            return jsonify({
                "success": True,
                "videoBase64": video_base64,
                "projectId": f"project_{int(time.time())}"
            })
            
        except Exception as e:
            error_trace = traceback.format_exc()
            print(f"[Render] Rendering error details:\n{error_trace}")
            return jsonify({
                "success": False,
                "error": f"렌더링 실패: {str(e)}",
                "details": error_trace[:500] if len(error_trace) > 500 else error_trace
            }), 500
        finally:
            # 임시 파일 정리
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                    print(f"[Render] Temp files cleaned up")
                except Exception as e:
                    print(f"[Render] 임시 파일 정리 오류: {str(e)}")
        
    except Exception as e:
        print(f"[Render] 에러: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"오류 발생: {str(e)}"
        }), 500

@app.route('/', methods=['GET'])
def health_check():
    """헬스 체크"""
    return jsonify({
        "status": "running",
        "service": "video-renderer",
        "endpoints": {
            "render": "POST /render"
        }
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
