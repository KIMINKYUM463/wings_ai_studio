import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function resolveOrigin(req: Request): string {
  const url = new URL(req.url)
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (url.protocol === "http:" ? "http" : "https")
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host
  return `${proto}://${host}`.replace(/\/$/, "")
}

/**
 * 수집기 확장 없이 에이전트 실행을 시도하는 팝업 페이지.
 * 1) shotform-agent:// 프로토콜
 * 2) 실패 시 .cmd 자동 다운로드 (최초 1회 실행하면 프로토콜 등록됨)
 */
export async function GET(req: Request) {
  const origin = resolveOrigin(req)
  const cmdUrl = `${origin}/api/shotform/local-agent/download?file=cmd`
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ShotForm Agent</title>
  <style>
    body { font-family: Segoe UI, sans-serif; background:#111; color:#eee; padding:24px; }
    a { color:#fbbf24; }
    .ok { color:#86efac; }
    .muted { color:#a1a1aa; font-size:13px; line-height:1.5; }
  </style>
</head>
<body>
  <h1>ShotForm Local Agent</h1>
  <p id="msg">Starting agent window...</p>
  <p class="muted">
    If a black cmd window does not appear, the downloaded
    <b>start-shotform-agent.cmd</b> will run once and register auto-start.
    After that, 「에이전트 실행」opens the window without the collector extension.
  </p>
  <p><a id="dl" href="${cmdUrl}">Download starter (.cmd)</a></p>
  <script>
    (function () {
      var msg = document.getElementById("msg");
      var cmdUrl = ${JSON.stringify(cmdUrl)};
      try {
        // Protocol handler (registered after first .cmd run)
        location.href = "shotform-agent://start";
      } catch (e) {}
      setTimeout(function () {
        msg.textContent = "If the agent window is not open, downloading starter...";
        msg.className = "ok";
        var a = document.createElement("a");
        a.href = cmdUrl;
        a.download = "start-shotform-agent.cmd";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, 900);
    })();
  </script>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
