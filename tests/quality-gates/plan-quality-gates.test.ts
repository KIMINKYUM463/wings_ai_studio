import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  canonicalProxyOrigin,
  decideMediaPersistence,
  decideOwnershipAccess,
  decideRightsBlock,
  decideSsrfUrl,
  evaluateFixture,
  mosaicExportRegion,
  proxyOriginFingerprint,
  scriptTtsHash,
  shouldRefreshMediaUrl,
  type EvalFixture,
} from "../../lib/plan-quality-gates.ts"
import { analyzeStoryMarketVideo } from "../../lib/story-market-intelligence.ts"

test("소유자가 일치할 때만 리소스 접근을 허용한다", () => {
  assert.deepEqual(decideOwnershipAccess("user-a", "user-a"), {
    allowed: true,
    reason: "owner-match",
  })
  assert.equal(decideOwnershipAccess("user-a", "user-b").allowed, false)
  assert.equal(decideOwnershipAccess(null, "user-a").reason, "authentication-required")
  assert.equal(decideOwnershipAccess("user-a", null).reason, "owner-missing")
})

test("SSRF 판정이 내부 주소, 자격 증명, 비 HTTP 스킴을 차단한다", () => {
  const blocked = [
    "http://127.0.0.1/admin",
    "http://127.1/admin",
    "http://10.0.0.8/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://service.internal/",
    "https://user:password@example.com/",
    "file:///etc/passwd",
  ]
  for (const url of blocked) assert.equal(decideSsrfUrl(url).allowed, false, url)
  assert.deepEqual(decideSsrfUrl("https://cdn.example.com/video.mp4"), {
    allowed: true,
    reason: "public-host-requires-dns-pin",
  })
})

test("blob/data/임시 서명 URL은 영구 저장 대상으로 판정한다", () => {
  assert.equal(decideMediaPersistence("blob:https://app.example/id").mustPersist, true)
  assert.equal(decideMediaPersistence("data:video/mp4;base64,AA==").mustPersist, true)
  assert.equal(decideMediaPersistence("https://replicate.delivery/output.mp4").mustPersist, true)
  assert.equal(
    decideMediaPersistence("https://cdn.example.com/a.mp4?X-Amz-Expires=300").mustPersist,
    true
  )
  assert.deepEqual(decideMediaPersistence("https://cdn.example.com/a.mp4"), {
    mustPersist: false,
    reason: "durable-url",
  })
})

test("프록시 URL과 직접 URL이 같은 원본 fingerprint를 만든다", () => {
  const direct = "https://CDN.example.com/video.mp4?b=2&a=1&token=temporary#fragment"
  const proxied = `/api/proxy-video?url=${encodeURIComponent(
    "https://cdn.example.com/video.mp4?a=1&b=2&token=other"
  )}`
  assert.equal(canonicalProxyOrigin(direct), "https://cdn.example.com/video.mp4?a=1&b=2")
  assert.equal(proxyOriginFingerprint(direct), proxyOriginFingerprint(proxied))
})

test("만료 시각 임박 또는 인증 실패 URL은 갱신한다", () => {
  const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0)
  assert.equal(
    shouldRefreshMediaUrl(`https://cdn.example/a.mp4?expires=${nowMs / 1_000 + 30}`, { nowMs }),
    true
  )
  assert.equal(
    shouldRefreshMediaUrl(`https://cdn.example/a.mp4?expires=${nowMs / 1_000 + 600}`, { nowMs }),
    false
  )
  assert.equal(shouldRefreshMediaUrl("https://cdn.example/a.mp4", { responseStatus: 403 }), true)
})

test("권리 미확인 또는 별도 허가 필요 자산은 export를 차단한다", () => {
  assert.equal(
    decideRightsBlock({ mediaUrl: "https://cdn.example/a.mp4", rightsConfirmed: false }).allowed,
    false
  )
  assert.equal(
    decideRightsBlock({
      mediaUrl: "https://cdn.example/a.mp4",
      rightsConfirmed: true,
      license: "permission-required",
    }).reason,
    "permission-required"
  )
  assert.equal(
    decideRightsBlock({ mediaUrl: "https://cdn.example/a.mp4", rightsConfirmed: true }).allowed,
    true
  )
})

test("대본-TTS hash는 공백과 유니코드를 정규화하고 음성 설정을 구분한다", () => {
  const base = scriptTtsHash({ script: "안녕   하세요", voiceId: "voice-a" })
  assert.equal(base, scriptTtsHash({ script: " 안녕 하세요 ", voiceId: "voice-a" }))
  assert.equal(
    scriptTtsHash({ script: "카페\u0301", voiceId: "voice-a" }),
    scriptTtsHash({ script: "카페́", voiceId: "voice-a" })
  )
  assert.notEqual(base, scriptTtsHash({ script: "안녕 하세요", voiceId: "voice-b" }))
  assert.notEqual(base, scriptTtsHash({ script: "안녕 하세요", voiceId: "voice-a", speed: 1.2 }))
})

test("모자이크 export 영역을 영상 경계와 재생 구간 안으로 제한한다", () => {
  assert.deepEqual(
    mosaicExportRegion(
      {
        xPct: 100,
        yPct: 0,
        widthPct: 20,
        heightPct: 10,
        startSec: -2,
        endSec: 99,
        blockSize: 5,
      },
      { width: 1080, height: 1920, durationSec: 30 }
    ),
    {
      x: 864,
      y: 0,
      width: 216,
      height: 192,
      startSec: 0,
      endSec: 30,
      blockSize: 5,
    }
  )
  assert.equal(
    mosaicExportRegion(
      { xPct: 50, yPct: 50, widthPct: 10, heightPct: 10, startSec: 10, endSec: 10 },
      { width: 1080, height: 1920, durationSec: 30 }
    ),
    null
  )
})

for (const seconds of [30, 60, 120] as const) {
  test(`${seconds}초 fixture의 품질·비용·지연 기준을 기계 판정한다`, () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL(`../fixtures/quality-gates/${seconds}s.json`, import.meta.url),
        "utf8"
      )
    ) as EvalFixture
    const result = evaluateFixture(fixture)
    assert.equal(fixture.durationSec, seconds)
    assert.equal(result.passed, true)
    assert.deepEqual(result.checks, { quality: true, cost: true, latency: true })
  })
}

test("eval harness는 어느 한 기준이라도 넘으면 실패한다", () => {
  const result = evaluateFixture({
    id: "regression",
    durationSec: 30,
    thresholds: { minQualityScore: 0.9, maxCostUsd: 0.08, maxLatencyMs: 15_000 },
    observed: { qualityScore: 0.89, costUsd: 0.081, latencyMs: 15_001 },
  })
  assert.equal(result.passed, false)
  assert.deepEqual(result.checks, { quality: false, cost: false, latency: false })
})

test("시장 영상 분석이 조회 성과와 훅 포맷을 구조화한다", () => {
  const signal = analyzeStoryMarketVideo({
    title: "Never make this cleaning mistake - before after",
    description: "One complete product demo",
    viewCount: 2_000_000,
    likeCount: 80_000,
    durationSec: 28,
    publishedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
  })
  assert.equal(signal.format, "before-after")
  assert.equal(signal.hookPattern, "결과 선공개")
  assert.ok(signal.performanceScore >= 70)
  assert.ok(signal.viewsPerDay >= 190_000)
})
