import test from "node:test"
import assert from "node:assert/strict"
import {
  fullProductImagePrompt,
  handContactContract,
  parseProductIdentityVerdict,
  productReferenceRolePrompt,
} from "../../lib/ai-shopping-product-fidelity.ts"

test("대체 이미지 프롬프트는 제품 전체를 유지한다", () => {
  const detail = fullProductImagePrompt("텀블러", "detail")
  assert.match(detail, /entire product still fully visible/)
  assert.match(detail, /NOT an extreme close-up/)
})

test("참고 사진 역할은 장수만큼만 전달한다", () => {
  const roles = productReferenceRolePrompt(2)
  assert.match(roles, /정면/)
  assert.match(roles, /측면/)
  assert.doesNotMatch(roles, /3번/)
})

test("손 장면은 한 동작과 한 접촉점만 허용한다", () => {
  assert.match(handContactContract(), /한 가지 동작/)
  assert.match(handContactContract(), /한 접촉점/)
})

test("제품 동일성 판정은 명시적 불일치만 재생성 대상으로 본다", () => {
  assert.equal(parseProductIdentityVerdict('{"match":false,"reason":"로고가 사라짐"}').match, false)
  assert.equal(parseProductIdentityVerdict("not-json").match, true)
})
