import test from "node:test"
import assert from "node:assert/strict"
import {
  buildRemixMarketFlow,
  buildRemixFlowPrompt,
  REMIX_PLATFORM_PLAYBOOKS,
} from "../../lib/remix-shopping-market-intelligence.ts"

test("리믹스 흐름은 첫 훅과 마지막 CTA를 보존한다", () => {
  for (const count of [2, 4, 5, 8, 12]) {
    const flow = buildRemixMarketFlow(count)
    assert.equal(flow.length, count)
    assert.equal(flow[0], "hook")
    assert.equal(flow.at(-1), "cta")
  }
})

test("긴 리믹스는 공개·데모·증명·신뢰 장치를 모두 포함한다", () => {
  const flow = buildRemixMarketFlow(9)
  assert.ok(flow.includes("reveal"))
  assert.ok(flow.includes("demo"))
  assert.ok(flow.includes("proof"))
  assert.ok(flow.includes("trust"))
})

test("교차 플랫폼 규칙은 세 플랫폼과 화면 정합성을 명시한다", () => {
  assert.deepEqual(Object.keys(REMIX_PLATFORM_PLAYBOOKS).sort(), [
    "instagram",
    "tiktok",
    "youtube",
  ])
  const prompt = buildRemixFlowPrompt(8)
  assert.match(prompt, /YouTube Shorts/)
  assert.match(prompt, /Instagram Reels/)
  assert.match(prompt, /TikTok/)
  assert.match(prompt, /자막·나레이션·화면 행동/)
})
