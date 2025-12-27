/**
 * 정교한 대본 분할 생성 헬퍼 함수
 * 각 분할의 정보(시간 구간, 목표 글자수 등)를 계산하는 유틸리티
 */

export interface PartInfo {
  startTime: string // "0:00"
  endTime: string // "4:30"
  targetChars: number
  minChars: number
  maxChars: number
  partLabel: string // "1회차", "2회차" 등
}

/**
 * 분할 정보 계산 함수
 */
export function getPartInfo(
  duration: number,
  partNumber: number,
  totalParts: number,
  targetChars?: number
): PartInfo {
  // 각 분할의 시간 구간 계산
  const partDuration = duration / totalParts // 각 분할의 분량
  const startMinutes = (partNumber - 1) * partDuration
  const endMinutes = partNumber * partDuration

  // 시간을 "분:초" 형식으로 변환
  const formatTime = (minutes: number): string => {
    const mins = Math.floor(minutes)
    const secs = Math.floor((minutes - mins) * 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startTime = formatTime(startMinutes)
  const endTime = formatTime(endMinutes)

  // 목표 글자수 계산
  let partTargetChars: number
  if (duration === 10) {
    // 10분: 각 50%
    partTargetChars = targetChars ? Math.floor(targetChars / totalParts) : 2150
  } else if (duration === 15) {
    // 15분: 1,2회차 2150자, 3회차 2250자
    partTargetChars = partNumber <= 2 ? 2150 : 2250
  } else if (duration === 20) {
    // 20분: 1,2,3회차 2150자, 4회차 2250자
    partTargetChars = partNumber <= 3 ? 2150 : 2250
  } else if (duration === 25) {
    // 25분: 1,2,3,4회차 2150자, 5회차 2250자
    partTargetChars = partNumber <= 4 ? 2150 : 2250
  } else if (duration === 30) {
    // 30분: 1,2,3,4,5회차 2150자, 6회차 2250자
    partTargetChars = partNumber <= 5 ? 2150 : 2250
  } else if (duration === 35) {
    // 35분: 1,2,3,4,5,6회차 2150자, 7회차 2350자
    partTargetChars = partNumber <= 6 ? 2150 : 2350
  } else if (duration === 40) {
    // 40분: 1,2,3,4,5,6,7회차 2150자, 8회차 2450자
    partTargetChars = partNumber <= 7 ? 2150 : 2450
  } else {
    // 기본값
    partTargetChars = targetChars ? Math.floor(targetChars / totalParts) : 2150
  }

  const minChars = Math.floor(partTargetChars * 0.95)
  const maxChars = Math.floor(partTargetChars * 1.1)

  const partLabel = `${partNumber}회차`

  return {
    startTime,
    endTime,
    targetChars: partTargetChars,
    minChars,
    maxChars,
    partLabel
  }
}

