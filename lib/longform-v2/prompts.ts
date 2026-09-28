/** WingsStudio v2 벤치마킹 대본 — 웹 포트용 프롬프트 */

import { v2ScriptTargetCharRange } from "./script-utils"

export function buildAnalyzePrompt(benchmarkScript: string): string {
  return `당신은 YouTube 롱폼 벤치마킹 분석가입니다.
아래 대본을 분석해 JSON만 출력하세요.

필수 키:
- coreTopic (string): 핵심 주제
- targetAudience (string): 타깃 시청자
- hookStrategy (string): 도입부 훅 전략
- bodyStructure (string): 본론 구조 요약
- toneGuide (string): 톤앤매너
- differentiation (string): 차별화 포인트
- estimatedLines (number): 예상 줄 수

대본:
---
${benchmarkScript.slice(0, 80000)}
---`
}

export function buildPlanPrompt(input: {
  benchmarkScript: string
  analysisJson: string
  topicDirection: string
  targetChars: number
}): string {
  const { min, max, target } = v2ScriptTargetCharRange(input.targetChars)
  return `당신은 YouTube 롱폼 콘텐츠 기획자입니다.
벤치마킹 대본과 패턴 분석을 바탕으로 **새 영상 기획안**을 JSON으로만 작성하세요.

규칙:
- 원본과 유사도 50% 이하로 재구성
- 사실·수치·사례는 과장하지 말 것
- 한국어

반환 JSON 키:
- coreTopic, targetAudience, hookStrategy, bodyStructure, differentiation, researchNotes, toneGuide
- estimatedLines (number)
- planMarkdown (string, 마크다운 기획안 전체 — 핵심 주제/도입/본론/차별화/톤 포함)

[주제 방향]
${input.topicDirection.trim() || "(미지정 — 분석에서 도출)"}

[목표 분량]
약 ${target.toLocaleString()}자 (허용 ${min.toLocaleString()}~${max.toLocaleString()}자)

[패턴 분석]
${input.analysisJson}

[벤치마킹 대본]
---
${input.benchmarkScript.slice(0, 100000)}
---`
}

export function buildGeneratePrompt(input: {
  benchmarkScript: string
  planMarkdown: string
  analysisJson: string
  topicDirection: string
  targetChars: number
}): string {
  const { min, max, target } = v2ScriptTargetCharRange(input.targetChars)
  return `당신은 YouTube 롱폼 나레이션 대본 작가입니다. 순수 대본 텍스트만 출력하세요.

[필수]
1. 제목·마크다운·번호 목록·코드블록 금지 — 나레이션만
2. 도입부: 인사 없이 위기감 훅 3~5문장 + 전환 멘트 1줄 (문장마다 줄바꿈)
3. 본문: 한 줄 100~200자, 200자 초과 시 줄바꿈
4. 원본 대비 유사도 50% 이하로 재구성
5. 목표 분량 약 ${target.toLocaleString()}자 (허용 ${min.toLocaleString()}~${max.toLocaleString()}자), ${max.toLocaleString()}자 초과 금지
6. 쉬운 단어, 직설적 톤 (~죠, ~거든요, ~겁니다 혼용)

[주제 방향]
${input.topicDirection.trim() || "(기획안 따름)"}

[기획안]
${input.planMarkdown.slice(0, 40000)}

[패턴 분석]
${input.analysisJson}

[벤치마킹 대본 — 참고만]
---
${input.benchmarkScript.slice(0, 60000)}
---`
}

export function buildSceneImagePromptRequest(sceneText: string, styleHint: string): string {
  return `You write ONE English image prompt for a YouTube long-form still (16:9).
Style: ${styleHint || "cinematic documentary illustration, clean composition"}
Scene narration (Korean, meaning only — do not put Korean text in the image):
"""
${sceneText.slice(0, 800)}
"""
Rules:
- No text, letters, watermarks, logos in the image
- 16:9 cinematic composition
- Match the Style description closely (line work, shading, palette, rendering)
- Output ONLY the English prompt, nothing else`
}

export function buildAnalyzeArtStylePrompt(): string {
  return `You are an expert art-style analyzer.
Analyze the uploaded image and extract ONLY the visual art style that can be reused on other scenes.

Return STRICT JSON only (no markdown):
{
  "styleHint": "dense English comma-separated art-style descriptors (medium, line, shading, palette, lighting, aesthetic). NO specific characters/objects/story.",
  "labelKo": "짧은 한글 그림체 이름 (예: 수채화 웹툰풍, 거친 연필 스케치)",
  "descriptionKo": "한글로 2~3문장. 어떤 그림체인지, 선·채색·분위기 위주로 설명. 특정 인물/사물 이야기는 쓰지 마세요."
}

Rules for styleHint:
- Focus on art medium, rendering, line quality, shading, color treatment, lighting mood, overall aesthetic
- DO NOT describe specific characters, objects, or layout of this image`
}
