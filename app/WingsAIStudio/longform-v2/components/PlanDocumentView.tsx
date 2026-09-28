"use client"

import { Fragment, type ReactNode } from "react"

type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; text: string }

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n")
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]?.trim() ?? ""
    if (!line) {
      i++
      continue
    }

    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() })
      i++
      continue
    }
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() })
      i++
      continue
    }

    const ulMatch = line.match(/^[-*]\s+(.+)$/)
    if (ulMatch) {
      const items: string[] = [ulMatch[1] ?? ""]
      i++
      while (i < lines.length) {
        const next = lines[i]?.trim() ?? ""
        const m = next.match(/^[-*]\s+(.+)$/)
        if (!m) break
        items.push(m[1] ?? "")
        i++
      }
      blocks.push({ type: "ul", items })
      continue
    }

    const olMatch = line.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      const items: string[] = [olMatch[1] ?? ""]
      i++
      while (i < lines.length) {
        const next = lines[i]?.trim() ?? ""
        const m = next.match(/^\d+\.\s+(.+)$/)
        if (!m) break
        items.push(m[1] ?? "")
        i++
      }
      blocks.push({ type: "ol", items })
      continue
    }

    const paraLines: string[] = [line]
    i++
    while (i < lines.length) {
      const next = lines[i]?.trim() ?? ""
      if (
        !next ||
        next.startsWith("## ") ||
        next.startsWith("### ") ||
        /^[-*]\s+/.test(next) ||
        /^\d+\.\s+/.test(next)
      ) {
        break
      }
      paraLines.push(next)
      i++
    }
    blocks.push({ type: "p", text: paraLines.join(" ") })
  }

  return blocks
}

type Props = {
  markdown: string
}

export function PlanDocumentView({ markdown }: Props) {
  const blocks = parseBlocks(markdown.trim())
  if (blocks.length === 0) {
    return <p className="v2sw-plan-doc__empty">기획안 내용이 없습니다.</p>
  }

  return (
    <article className="v2sw-plan-doc">
      {blocks.map((block, idx) => {
        const key = `${block.type}-${idx}`
        if (block.type === "h2") {
          return (
            <h4 key={key} className="v2sw-plan-doc__h2">
              {renderInline(block.text)}
            </h4>
          )
        }
        if (block.type === "h3") {
          return (
            <h5 key={key} className="v2sw-plan-doc__h3">
              {renderInline(block.text)}
            </h5>
          )
        }
        if (block.type === "ul") {
          return (
            <ul key={key} className="v2sw-plan-doc__list">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInline(item)}</li>
              ))}
            </ul>
          )
        }
        if (block.type === "ol") {
          return (
            <ol key={key} className="v2sw-plan-doc__list v2sw-plan-doc__list--ol">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInline(item)}</li>
              ))}
            </ol>
          )
        }
        return (
          <p key={key} className="v2sw-plan-doc__p">
            {renderInline(block.text)}
          </p>
        )
      })}
    </article>
  )
}
