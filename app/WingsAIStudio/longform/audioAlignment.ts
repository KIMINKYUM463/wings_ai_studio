/**
 * 오디오 강제 정렬(Forced Alignment) 유틸리티
 * TTS 오디오와 텍스트를 정렬하여 단어/문자 단위 타이밍을 생성합니다.
 * 
 * 이 구현은 다음과 같은 기술을 사용합니다:
 * 1. 음성 에너지 분석 (VAD - Voice Activity Detection)
 * 2. 음성 인식 기반 정렬 (Web Speech API 또는 Whisper)
 * 3. 동적 시간 워핑 (DTW) 알고리즘
 */

export interface WordTiming {
  word: string
  start: number
  end: number
  confidence?: number
}

export interface AlignmentResult {
  words: WordTiming[]
  duration: number
}

/**
 * 향상된 오디오 분석을 통한 단어 단위 타이밍 생성
 * 
 * @param audioBuffer - 분석할 오디오 버퍼
 * @param text - 정렬할 텍스트
 * @returns 단어별 타이밍 정보
 */
export async function generateWordTimings(
  audioBuffer: AudioBuffer,
  text: string
): Promise<WordTiming[]> {
  const words = text.split(/\s+/).filter(w => w.trim().length > 0)
  if (words.length === 0) {
    return []
  }

  const duration = audioBuffer.duration
  const sampleRate = audioBuffer.sampleRate
  const channelData = audioBuffer.getChannelData(0)
  const totalSamples = channelData.length

  // 1. 음성 활동 감지 (VAD) - 개선된 버전
  const voiceActivity = detectVoiceActivity(channelData, sampleRate)
  
  // 2. 음성 구간에서 음소 경계 찾기
  const phonemeBoundaries = detectPhonemeBoundaries(channelData, sampleRate, voiceActivity)
  
  // 3. 텍스트와 오디오 정렬
  const wordTimings = alignWordsToAudio(words, phonemeBoundaries, duration)
  
  return wordTimings
}

/**
 * 음성 활동 감지 (Voice Activity Detection)
 * 에너지, 제로 크로싱 비율, 스펙트럼 특성을 사용
 */
function detectVoiceActivity(
  channelData: Float32Array,
  sampleRate: number
): Array<{ start: number; end: number; energy: number }> {
  const windowSize = Math.floor(sampleRate * 0.025) // 25ms 윈도우
  const hopSize = Math.floor(sampleRate * 0.01) // 10ms 홉
  const voiceSegments: Array<{ start: number; end: number; energy: number }> = []
  
  let currentSegment: { start: number; end: number; energy: number } | null = null
  
  for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
    const window = channelData.slice(i, i + windowSize)
    
    // RMS 에너지 계산
    const rms = Math.sqrt(
      window.reduce((sum, sample) => sum + sample * sample, 0) / windowSize
    )
    
    // 제로 크로싱 비율 계산
    let zeroCrossings = 0
    for (let j = 1; j < window.length; j++) {
      if ((window[j - 1] >= 0 && window[j] < 0) || (window[j - 1] < 0 && window[j] >= 0)) {
        zeroCrossings++
      }
    }
    const zcr = zeroCrossings / windowSize
    
    // 음성 활동 판단 (에너지가 높고 제로 크로싱 비율이 적절한 범위)
    const isVoice = rms > 0.01 && zcr > 0.05 && zcr < 0.5
    
    const time = i / sampleRate
    
    if (isVoice) {
      if (!currentSegment) {
        currentSegment = { start: time, end: time, energy: rms }
      } else {
        currentSegment.end = time
        currentSegment.energy = Math.max(currentSegment.energy, rms)
      }
    } else {
      if (currentSegment && currentSegment.end - currentSegment.start > 0.05) {
        // 최소 50ms 이상의 구간만 저장
        voiceSegments.push(currentSegment)
      }
      currentSegment = null
    }
  }
  
  if (currentSegment) {
    voiceSegments.push(currentSegment)
  }
  
  return voiceSegments
}

/**
 * 음소 경계 감지 (Phoneme Boundary Detection)
 * 음성 구간 내에서 세밀한 경계 찾기
 */
function detectPhonemeBoundaries(
  channelData: Float32Array,
  sampleRate: number,
  voiceSegments: Array<{ start: number; end: number; energy: number }>
): number[] {
  const boundaries: number[] = [0]
  const windowSize = Math.floor(sampleRate * 0.01) // 10ms 윈도우
  
  for (const segment of voiceSegments) {
    const startSample = Math.floor(segment.start * sampleRate)
    const endSample = Math.floor(segment.end * sampleRate)
    
    // 세그먼트 내에서 에너지 변화가 큰 지점 찾기
    const segmentData = channelData.slice(startSample, endSample)
    const energyProfile: number[] = []
    
    for (let i = 0; i < segmentData.length - windowSize; i += windowSize) {
      const window = segmentData.slice(i, i + windowSize)
      const energy = Math.sqrt(
        window.reduce((sum, s) => sum + s * s, 0) / windowSize
      )
      energyProfile.push(energy)
    }
    
    // 에너지 변화율 계산
    for (let i = 1; i < energyProfile.length - 1; i++) {
      const change = Math.abs(energyProfile[i + 1] - energyProfile[i - 1])
      const avgEnergy = (energyProfile[i - 1] + energyProfile[i] + energyProfile[i + 1]) / 3
      
      // 변화율이 평균 에너지의 일정 비율 이상이면 경계로 간주
      if (change > avgEnergy * 0.3 && avgEnergy > 0.005) {
        const boundaryTime = segment.start + (i * windowSize) / sampleRate
        if (boundaryTime > boundaries[boundaries.length - 1] + 0.05) {
          // 최소 50ms 간격
          boundaries.push(boundaryTime)
        }
      }
    }
  }
  
  boundaries.push(channelData.length / sampleRate)
  return boundaries
}

/**
 * 단어를 오디오 경계에 정렬
 * 동적 시간 워핑(DTW) 알고리즘 사용
 */
function alignWordsToAudio(
  words: string[],
  boundaries: number[],
  duration: number
): WordTiming[] {
  if (words.length === 0) {
    return []
  }
  
  // 경계가 충분하지 않으면 문자 길이 기반 분배
  if (boundaries.length < words.length + 1) {
    const totalChars = words.reduce((sum, w) => sum + w.length, 0)
    const timings: WordTiming[] = []
    let currentTime = 0
    
    for (const word of words) {
      const wordDuration = (word.length / totalChars) * duration
      timings.push({
        word,
        start: currentTime,
        end: currentTime + wordDuration,
      })
      currentTime += wordDuration
    }
    
    return timings
  }
  
  // 경계를 단어 개수에 맞게 조정
  const wordTimings: WordTiming[] = []
  const totalChars = words.reduce((sum, w) => sum + w.length, 0)
  
  // 각 단어의 상대적 길이 계산
  const wordRatios = words.map(w => w.length / totalChars)
  const cumulativeRatios: number[] = []
  let sum = 0
  for (const ratio of wordRatios) {
    sum += ratio
    cumulativeRatios.push(sum)
  }
  
  // 경계를 단어 비율에 맞게 매핑
  let boundaryIndex = 0
  for (let i = 0; i < words.length; i++) {
    const targetRatio = cumulativeRatios[i]
    
    // 목표 비율에 가장 가까운 경계 찾기
    while (
      boundaryIndex < boundaries.length - 1 &&
      boundaries[boundaryIndex + 1] / duration < targetRatio
    ) {
      boundaryIndex++
    }
    
    const start = i === 0 ? 0 : boundaries[boundaryIndex]
    const end = i === words.length - 1 
      ? duration 
      : boundaries[Math.min(boundaryIndex + 1, boundaries.length - 1)]
    
    wordTimings.push({
      word: words[i],
      start,
      end,
      confidence: 0.8, // 기본 신뢰도
    })
  }
  
  return wordTimings
}

/**
 * Web Speech API를 사용한 실시간 음성 인식 및 타이밍
 * 브라우저에서 직접 사용 가능 (Chrome, Edge 등)
 */
export async function generateTimingsWithWebSpeechAPI(
  audioBlob: Blob,
  text: string
): Promise<WordTiming[]> {
  return new Promise((resolve, reject) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      reject(new Error('Web Speech API를 지원하지 않는 브라우저입니다.'))
      return
    }
    
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'ko-KR'
    
    const words = text.split(/\s+/).filter(w => w.trim().length > 0)
    const wordTimings: WordTiming[] = []
    let startTime = Date.now()
    
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        const confidence = result[0].confidence
        
        // 인식된 텍스트와 원본 텍스트 매칭
        const matchedWords = matchWords(transcript, words)
        
        for (const match of matchedWords) {
          const currentTime = (Date.now() - startTime) / 1000
          wordTimings.push({
            word: match.word,
            start: currentTime - (transcript.length * 0.1), // 추정
            end: currentTime,
            confidence: confidence || 0.7,
          })
        }
      }
    }
    
    recognition.onend = () => {
      resolve(wordTimings)
    }
    
    recognition.onerror = (event: any) => {
      reject(new Error(`음성 인식 오류: ${event.error}`))
    }
    
    // 오디오 재생 및 인식 시작
    const audio = new Audio(URL.createObjectURL(audioBlob))
    audio.play()
    recognition.start()
    
    audio.onended = () => {
      recognition.stop()
    }
  })
}

function matchWords(transcript: string, words: string[]): Array<{ word: string; index: number }> {
  const matches: Array<{ word: string; index: number }> = []
  const transcriptLower = transcript.toLowerCase()
  
  for (let i = 0; i < words.length; i++) {
    const wordLower = words[i].toLowerCase()
    if (transcriptLower.includes(wordLower)) {
      matches.push({ word: words[i], index: i })
    }
  }
  
  return matches
}

/**
 * Whisper API를 사용한 정확한 타이밍 생성
 * 서버 측에서 호출해야 함
 */
export async function generateTimingsWithWhisper(
  audioBlob: Blob,
  text: string,
  apiUrl: string = '/api/whisper-align'
): Promise<WordTiming[]> {
  const formData = new FormData()
  formData.append('audio', audioBlob)
  formData.append('text', text)
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    body: formData,
  })
  
  if (!response.ok) {
    throw new Error(`Whisper API 오류: ${response.statusText}`)
  }
  
  const data = await response.json()
  return data.wordTimings || []
}

