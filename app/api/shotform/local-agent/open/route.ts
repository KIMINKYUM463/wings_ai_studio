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
  <p id="msg">Starting agent...</p>
  <p class="muted">
    If you see <b>'node' is not recognized</b>, the old protocol is broken.<br/>
    Run the downloaded <b>start-shotform-agent.cmd</b> once (after Node.js LTS install).<br/>
    That rewrites the protocol to use the full Node path.
  </p>
  <p><a id="dl" href="${cmdUrl}">Download / repair starter (.cmd)</a></p>
  <script>
    (function () {
      var msg = document.getElementById("msg");
      var cmdUrl = ${JSON.stringify(cmdUrl)};
      // Always download repair starter first (fixes bare 'node' protocol)
      var a = document.createElement("a");
      a.href = cmdUrl;
      a.download = "start-shotform-agent.cmd";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        msg.textContent = "Trying shotform-agent:// ... if cmd shows node error, double-click the downloaded starter.";
        msg.className = "ok";
        try { location.href = "shotform-agent://start"; } catch (e) {}
      }, 600);
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
