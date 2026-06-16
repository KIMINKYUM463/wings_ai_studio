/** 쇼핑숏폼 대본 품질 — 키워드 남발·번역체·중복 감지·완화 */

export const NARRATION_PRODUCT_NAME_USAGE_RULE = `**제품명(키워드) 언급**: 사용자가 이미 키워드로 제품을 알고 있음. **전체 키워드(예: 무선 마우스)는 컷1 후킹 1회 + 마지막 CTA 1회만**. 중간 컷은 「이거」「마우스」「손에 쥔 이 친구」「이 제품」 등으로 지칭. **「무선 마우스, 설치가…」처럼 매 컷 제품명으로 시작 금지**.`

const GENERIC_BAD_NARRATION = [
  /설치가 (이렇게 )?간편/,
  /사용이 이렇게 간/,
  /완벽하게 작동/,
  /클릭(만|해보).*완벽/,
  /모든 것이 해결/,
  /모델 번호를 확인하고,?\s*문제를 해결/,
  /이제 클릭만 하면/,
  /설치가 정말 쉽/,
  /사용이 (이렇게 )?간편/,
] as const

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function lineMentionsPrimary(line: string, primary: string): boolean {
  const t = line.replace(/\n/g, " ").trim()
  if (!t || !primary) return false
  if (t.includes(primary)) return true
  const compact = primary.replace(/\s+/g, "")
  return compact.length >= 2 && t.replace(/\s+/g, "").includes(compact)
}

/** 규칙 기반 품질 이슈 — AI 검수 트리거·프롬프트 힌트 */
export function detectShoppingScriptQualityIssues(
  lines: readonly string[],
  primaryLabel: string
): string[] {
  const issues: string[] = []
  const primary = primaryLabel.trim()
  if (!lines.length) return issues

  let nameHits = 0
  for (const line of lines) {
    if (lineMentionsPrimary(line, primary)) nameHits++
  }
  if (lines.length >= 3 && nameHits > 2) {
    issues.push(`키워드「${primary}」가 ${nameHits}회 — 후킹·CTA 외 반복`)
  }

  for (const line of lines) {
    const t = line.replace(/\n/g, " ").trim()
    if (!t) continue
    if (new RegExp(`^${escapeRegExp(primary)}\\s*,`, "i").test(t)) {
      issues.push(`제품명 접두 반복: ${t.slice(0, 36)}`)
    }
    for (const re of GENERIC_BAD_NARRATION) {
      if (re.test(t)) {
        issues.push(`번역체·템플릿: ${t.slice(0, 40)}`)
        break
      }
    }
  }

  const seen = new Map<string, number>()
  for (const line of lines) {
    const n = line.replace(/\n/g, " ").trim()
    if (n.length < 10) continue
    seen.set(n, (seen.get(n) ?? 0) + 1)
  }
  for (const [line, count] of seen) {
    if (count >= 2) issues.push(`동일 문장 ${count}회: ${line.slice(0, 36)}`)
  }

  return [...new Set(issues)].slice(0, 14)
}

/** 키워드 제품명 남발 완화 — AI 검수 전·후 규칙 보정 */
export function mitigateProductNameSpam(
  lines: readonly string[],
  primaryLabel: string
): string[] {
  const primary = primaryLabel.trim()
  if (!primary || lines.length < 2) return [...lines]

  let explicitMentions = 0
  const maxExplicit = 2

  return lines.map((line, i) => {
    const isFirst = i === 0
    const isLast = i === lines.length - 1
    let t = line.replace(/\n/g, " ").trim()
    if (!t) return line

    const leadRe = new RegExp(`^${escapeRegExp(primary)}\\s*,\\s*`, "i")
    if (leadRe.test(t) && !isFirst && !isLast) {
      t = t.replace(leadRe, "").trim()
    }

    if (lineMentionsPrimary(t, primary)) {
      explicitMentions++
      if (explicitMentions > maxExplicit && !isLast) {
        t = t
          .replace(new RegExp(`${escapeRegExp(primary)}\\s*,?\\s*`, "gi"), "")
          .replace(/^\s*,\s*/, "")
          .trim()
      }
    }

    if (t.length < 4 && !isFirst) return line
    return t
  })
}
