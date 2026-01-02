/**
 * 자막 생성 API 사용 예제
 * 
 * 사용법:
 * node scripts/generate-srt-example.js <오디오파일경로>
 * 
 * 예시:
 * node scripts/generate-srt-example.js ./audio.mp3
 */

const fs = require('fs')
const path = require('path')
const FormData = require('form-data')
const fetch = require('node-fetch')

async function generateSRT(audioFilePath) {
  try {
    console.log(`[예제] 오디오 파일 읽기: ${audioFilePath}`)
    
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${audioFilePath}`)
    }
    
    // FormData 생성
    const formData = new FormData()
    const audioFile = fs.createReadStream(audioFilePath)
    formData.append('audio', audioFile, path.basename(audioFilePath))
    formData.append('apiKey', 'CYm46zmVT9RVNxVTWVefTVfFEF4nWUuZ')
    formData.append('language', 'korean')
    formData.append('outputDir', './output')
    
    console.log('[예제] API 호출 중...')
    
    // API 호출 (로컬 서버인 경우)
    const response = await fetch('http://localhost:3000/api/generate-srt', {
      method: 'POST',
      body: formData,
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 호출 실패: ${response.status} - ${errorText}`)
    }
    
    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || '알 수 없는 오류')
    }
    
    console.log(`[예제] 성공! ${result.subtitleCount}개 자막 생성`)
    console.log(`[예제] 오디오 길이: ${result.audioDuration.toFixed(2)}초`)
    
    // SRT 파일 저장
    if (result.srt) {
      const srtPath = path.join('./output', 'captions.srt')
      fs.mkdirSync('./output', { recursive: true })
      fs.writeFileSync(srtPath, result.srt, 'utf-8')
      console.log(`[예제] SRT 파일 저장: ${srtPath}`)
    }
    
    // 디버그 JSON 저장
    if (result.debug) {
      const debugPath = path.join('./output', 'captions.debug.json')
      fs.writeFileSync(debugPath, JSON.stringify(result.debug, null, 2), 'utf-8')
      console.log(`[예제] 디버그 JSON 저장: ${debugPath}`)
    }
    
    console.log('[예제] 완료!')
    
  } catch (error) {
    console.error('[예제] 오류:', error.message)
    process.exit(1)
  }
}

// 명령줄 인자 확인
const audioFilePath = process.argv[2]

if (!audioFilePath) {
  console.error('사용법: node scripts/generate-srt-example.js <오디오파일경로>')
  process.exit(1)
}

generateSRT(audioFilePath)







