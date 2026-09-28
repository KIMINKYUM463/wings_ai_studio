import { useLayoutEffect, useRef } from 'react'

/** 사이드바 「저장」·모달 닫기 등이 호출할 비동기 저장 — `null`이면 등록 해제 */
export type StepToolbarSaveHandler = () => Promise<void | boolean>
export type StepToolbarSaveBinder = (fn: StepToolbarSaveHandler | null) => void

/**
 * 마운트되는 동안 좌측 공통 저장 버튼에 `save`를 연결한다.
 * `save`는 렌더마다 바뀌어도 되도록 ref로 최신본을 호출한다.
 */
export function useRegisterStepToolbarSave(
  bind: StepToolbarSaveBinder | undefined,
  save: StepToolbarSaveHandler,
): void {
  const saveRef = useRef(save)
  saveRef.current = save
  useLayoutEffect(() => {
    if (!bind) return
    bind(async () => saveRef.current())
    return () => {
      bind(null)
    }
  }, [bind])
}
