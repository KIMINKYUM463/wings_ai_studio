import test from "node:test"
import assert from "node:assert/strict"
import {
  planVoiceLedClip,
  stillPanFilter,
  voiceLedTargetSeconds,
  SHORTS_MASTER,
} from "../../lib/shorts-master-quality.ts"

test("음성 길이보다 0.08초 긴 장면 길이를 만든다", () => {
  assert.equal(voiceLedTargetSeconds(4), 4.08)
  assert.equal(voiceLedTargetSeconds(12, 12), 12)
})

test("원본이 조금 짧으면 0.75배까지만 느리게 재생한다", () => {
  const plan = planVoiceLedClip(3.2, 4)
  assert.ok(plan.speed >= 0.75)
  assert.equal(plan.freezeAfterSec, 0)
})

test("원본이 너무 짧으면 마지막 프레임 정지로 음성을 채운다", () => {
  const plan = planVoiceLedClip(1, 4)
  assert.equal(plan.speed, 0.75)
  assert.ok(plan.freezeAfterSec > 0)
})

test("정지 사진 마스터는 1080×1920과 6% 이동을 사용한다", () => {
  const filter = stillPanFilter(4, "right")
  assert.match(filter, /1080:1920/)
  assert.match(filter, /fps=30/)
  assert.equal(SHORTS_MASTER.crf, "20")
  assert.equal(SHORTS_MASTER.audioBitrate, "192k")
})
