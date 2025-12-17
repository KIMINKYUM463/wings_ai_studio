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
        character_image = data.get('characterImage')  # base64 이미지
        character_image_gcs_url = data.get('characterImageGcsUrl')  # Cloud Storage URL 이미지
        auto_images = data.get('autoImages', [])  # 여러 이미지 배열
        duration = data.get('duration', 0)
        
        if not audio_base64 and not audio_gcs_url:
            return jsonify({
                "success": False,
                "error": "audioBase64 또는 audioGcsUrl이 필요합니다."
            }), 400
        
        if not character_image and not character_image_gcs_url:
            return jsonify({
                "success": False,
                "error": "characterImage 또는 characterImageGcsUrl이 필요합니다."
            }), 400
        
        print(f"[Render] Request received - duration: {duration}s, subtitles: {len(subtitles)}, autoImages: {len(auto_images)}")
        if audio_gcs_url:
            print(f"[Render] Using Cloud Storage URL: {audio_gcs_url}")
        elif audio_base64:
            print(f"[Render] Using base64 audio (size: {len(audio_base64) / 1024:.2f} KB)")
        else:
            print(f"[Render] No audio data provided")
        
        if character_image_gcs_url:
            print(f"[Render] Using characterImage Cloud Storage URL: {character_image_gcs_url}")
        elif character_image:
            print(f"[Render] Using base64 characterImage (size: {len(character_image) / 1024:.2f} KB)")
        else:
            print(f"[Render] No characterImage data provided")
        
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
            
            # 기본 배경 이미지 (character_image 또는 character_image_gcs_url)
            try:
                if character_image_gcs_url:
                    # Cloud Storage URL에서 다운로드
                    print(f"[Render] Processing background image from Cloud Storage: {character_image_gcs_url}")
                    img_path = download_image(character_image_gcs_url, f"{temp_dir}/background")
                    print(f"[Render] Background image downloaded from GCS: {img_path}")
                elif character_image:
                    # base64 이미지 처리
                    print(f"[Render] Processing background image: {character_image[:50]}...")
                    img_path = download_image(character_image, f"{temp_dir}/background")
                    print(f"[Render] Background image saved: {img_path}")
                else:
                    raise Exception("characterImage 또는 characterImageGcsUrl이 필요합니다.")
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
                    
                    segment_files = []
                    for idx, (img_file, seg_start_time, seg_end_time) in enumerate(image_segments):
                        segment_duration = seg_end_time - seg_start_time
                        if segment_duration <= 0:
                            continue
                        
                        segment_output = f"{temp_dir}/segment_{idx}.mp4"
                        print(f"[Render] Processing segment {idx}: {img_file} ({segment_duration:.2f}s)")
                        
                        # 이 세그먼트에 해당하는 자막 필터 생성 (같은 시간대 자막을 한 줄로 합침)
                        segment_subtitle_filters = []
                        if subtitles:
                            # 시간대별로 자막 그룹화
                            subtitle_groups = {}
                            for sub in subtitles:
                                sub_start = float(sub.get('start', sub.get('startTime', 0)))
                                sub_end = float(sub.get('end', sub.get('endTime', sub_start + 2)))
                                
                                # 자막이 이 세그먼트 시간 범위와 겹치면 포함
                                # 단, 자막이 세그먼트 시작 시간 이전에 시작하면 제외 (이전 장면의 자막 제외)
                                if not (sub_end < seg_start_time or sub_start > seg_end_time):
                                    # 자막이 세그먼트 시작 시간 이전에 시작하면 제외
                                    if sub_start < seg_start_time:
                                        continue
                                    
                                    adjusted_start = max(0, sub_start - seg_start_time)
                                    adjusted_end = min(segment_duration, sub_end - seg_start_time)
                                    
                                    # adjusted_start가 0보다 작거나 같아야 함 (세그먼트 내에서 시작)
                                    if adjusted_start < 0:
                                        continue
                                    
                                    text = sub.get('text', '').strip()
                                    if not text:
                                        continue
                                    
                                    # 같은 시작 시간의 자막들을 그룹화
                                    key = f"{adjusted_start:.2f}"
                                    if key not in subtitle_groups:
                                        subtitle_groups[key] = {
                                            'texts': [],
                                            'start': adjusted_start,
                                            'end': adjusted_end
                                        }
                                    subtitle_groups[key]['texts'].append(text)
                                    subtitle_groups[key]['end'] = max(subtitle_groups[key]['end'], adjusted_end)
                            
                            # 그룹화된 자막을 한 줄로 합쳐서 필터 생성
                            for key, group in subtitle_groups.items():
                                # 여러 자막을 공백으로 합쳐서 한 줄로 표시 (줄바꿈 문자 제거)
                                combined_text = ' '.join(group['texts']).replace('\n', ' ').replace('\r', ' ').strip()
                                
                                # 텍스트 이스케이프 (FFmpeg drawtext용)
                                text_escaped = combined_text.replace('\\', '\\\\').replace(':', '\\:').replace("'", "\\'").replace('[', '\\[').replace(']', '\\]')
                                
                                # drawtext 필터 파라미터 저장
                                segment_subtitle_filters.append({
                                    'text': text_escaped,
                                    'start': group['start'],
                                    'end': group['end']
                                })
                        
                        # FFmpeg-python으로 세그먼트 렌더링
                        input_video = ffmpeg.input(img_file, loop=1, framerate=1, t=segment_duration)
                        
                        # 기본 필터: 이미지 크기 조정
                        stream = input_video.video.filter('scale', 1920, 1080, force_original_aspect_ratio='decrease')
                        stream = stream.filter('pad', 1920, 1080, '(ow-iw)/2', '(oh-ih)/2', color='black')
                        
                        # 자막 필터 추가 (한 줄, 큰 글씨)
                        for sub_info in segment_subtitle_filters:
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
                                print(f"[Render] 자막 텍스트: {text_for_display[:50]}...")
                                raise
                        
                        # 출력 설정
                        output = ffmpeg.output(
                            stream,
                            segment_output,
                            vcodec='libx264',
                            preset='veryfast',
                            crf=23,
                            tune='stillimage',
                            pix_fmt='yuv420p'
                        )
                        
                        ffmpeg.run(output, overwrite_output=True, quiet=True)
                        
                        if os.path.exists(segment_output) and os.path.getsize(segment_output) > 0:
                            segment_files.append(segment_output)
                            print(f"[Render] Segment {idx} rendered: {segment_duration:.2f}s")
                    
                    if len(segment_files) == 0:
                        raise Exception("No valid segments created")
                    
                    # 세그먼트 파일 목록 생성 (concat용)
                    concat_list_path = f"{temp_dir}/concat_list.txt"
                    with open(concat_list_path, 'w') as f:
                        for seg_file in segment_files:
                            f.write(f"file '{seg_file}'\n")
                    
                    # 오디오와 함께 concat (subprocess 사용 - FFmpeg-python의 concat이 복잡함)
                    audio_codec_param = []
                    if audio_codec and audio_codec.lower() in ['aac', 'mp3']:
                        audio_codec_param = ['-c:a', 'copy']
                    else:
                        audio_codec_param = ['-c:a', 'aac', '-b:a', '256k']
                    
                    concat_cmd = [
                        'ffmpeg',
                        '-y',
                        '-f', 'concat',
                        '-safe', '0',
                        '-i', concat_list_path,
                        '-i', audio_path,
                        '-c:v', 'copy',
                    ] + audio_codec_param + [
                        '-map', '0:v:0',
                        '-map', '1:a:0',
                        '-shortest',
                        '-movflags', '+faststart',
                        output_path
                    ]
                    
                    if duration and duration > 0:
                        concat_cmd.insert(-1, '-t')
                        concat_cmd.insert(-1, str(duration))
                    
                    result = subprocess.run(concat_cmd, capture_output=True, text=True, timeout=900)
                    if result.returncode != 0:
                        raise Exception(f"Concat failed: {result.stderr}")
                    
                else:
                    # 단일 이미지
                    img_path = image_segments[0][0] if image_segments else img_path
                    print(f"[Render] Processing single image: {img_path}")
                    
                    # 자막 필터 생성 (같은 시간대 자막을 한 줄로 합침)
                    subtitle_filters = []
                    if subtitles:
                        # 시간대별로 자막 그룹화
                        subtitle_groups = {}
                        for sub in subtitles:
                            text = sub.get('text', '').strip()
                            start_time = float(sub.get('start', sub.get('startTime', 0)))
                            end_time = float(sub.get('end', sub.get('endTime', start_time + 2)))
                            
                            if not text:
                                continue
                            
                            # 같은 시작 시간의 자막들을 그룹화
                            key = f"{start_time:.2f}"
                            if key not in subtitle_groups:
                                subtitle_groups[key] = {
                                    'texts': [],
                                    'start': start_time,
                                    'end': end_time
                                }
                            subtitle_groups[key]['texts'].append(text)
                            subtitle_groups[key]['end'] = max(subtitle_groups[key]['end'], end_time)
                        
                        # 그룹화된 자막을 한 줄로 합쳐서 필터 생성
                        for key, group in subtitle_groups.items():
                            # 여러 자막을 공백으로 합쳐서 한 줄로 표시 (줄바꿈 문자 제거)
                            combined_text = ' '.join(group['texts']).replace('\n', ' ').replace('\r', ' ').strip()
                            
                            text_escaped = combined_text.replace('\\', '\\\\').replace(':', '\\:').replace("'", "\\'").replace('[', '\\[').replace(']', '\\]')
                            
                            subtitle_filters.append({
                                'text': text_escaped,
                                'start': group['start'],
                                'end': group['end']
                            })
                    
                    # FFmpeg-python으로 렌더링
                    input_video = ffmpeg.input(img_path, loop=1, framerate=1)
                    input_audio = ffmpeg.input(audio_path)
                    
                    # 기본 필터
                    stream = input_video.video.filter('scale', 1920, 1080, force_original_aspect_ratio='decrease')
                    stream = stream.filter('pad', 1920, 1080, '(ow-iw)/2', '(oh-ih)/2', color='black')
                    
                    # 자막 필터 추가 (한 줄, 큰 글씨)
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
                    output = ffmpeg.output(
                        stream,
                        input_audio,
                        output_path,
                        vcodec='libx264',
                        preset='veryfast',
                        crf=23,
                        tune='stillimage',
                        pix_fmt='yuv420p',
                        acodec=audio_codec_str,
                        shortest=None,
                        movflags='+faststart'
                    )
                    
                    if duration and duration > 0:
                        output = ffmpeg.output(output, t=duration)
                    
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
