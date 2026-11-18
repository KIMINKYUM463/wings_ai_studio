/**
 * 녹화용 프레임 타이머. requestAnimationFrame은 탭이 가려지거나 창 포커스를 잃으면
 * 멈추거나 수 fps로 떨어져 녹화가 끊기므로, 스로틀되지 않는 Worker 타이머로 틱을 보낸다.
 * @returns 정지 함수
 */
export function startRenderTicker(onTick: () => void, fps = 30): () => void {
  const source = `const id = setInterval(() => postMessage(0), ${Math.round(1000 / fps)}); onmessage = () => clearInterval(id)`
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }))
  const worker = new Worker(url)
  worker.onmessage = () => onTick()
  return () => {
    worker.postMessage(0)
    worker.terminate()
    URL.revokeObjectURL(url)
  }
}

/**
 * requestAnimationFrame/cancelAnimationFrame과 같은 모양의 스케줄러.
 * 대기 중인 콜백이 있을 때만 Worker 타이머를 켠다.
 */
export function createBackgroundFrameScheduler(fps = 60) {
  const callbacks = new Map<number, FrameRequestCallback>()
  let nextId = 1
  let stopTicker: (() => void) | null = null

  const flush = () => {
    const due = [...callbacks.values()]
    callbacks.clear()
    const now = performance.now()
    for (const callback of due) callback(now)
    if (callbacks.size === 0 && stopTicker) {
      stopTicker()
      stopTicker = null
    }
  }

  return {
    request(callback: FrameRequestCallback): number {
      const id = nextId++
      callbacks.set(id, callback)
      stopTicker ??= startRenderTicker(flush, fps)
      return id
    },
    cancel(id: number | null | undefined) {
      if (id != null) callbacks.delete(id)
    },
  }
}
