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
 * 안내 + OS별 스타터 다운로드.
 * 깨진 shotform-agent:// (bare node → System32 오류) 는 호출하지 않음.
 * OS는 페이지 안 navigator 로 최종 판별 (서버 UA 보조).
 */
export async function GET(req: Request) {
  const origin = resolveOrigin(req)
  const downloadBase = `${origin}/api/shotform/local-agent/download`
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ShotForm Agent</title>
  <style>
    body { font-family: "Segoe UI", "Apple SD Gothic Neo", sans-serif; background:#111; color:#eee; padding:28px; line-height:1.55; }
    h1 { font-size:20px; margin:0 0 12px; }
    .ok { color:#86efac; }
    .warn { color:#fbbf24; }
    .muted { color:#a1a1aa; font-size:13px; }
    a.btn { display:inline-block; margin-top:14px; padding:10px 14px; background:#f59e0b; color:#111; font-weight:700; text-decoration:none; border-radius:8px; }
    ol { padding-left: 1.2em; }
  </style>
</head>
<body>
  <h1>ShotForm Local Agent</h1>
  <p class="ok" id="msg">실행 파일 받는 중…</p>
  <p class="muted" style="margin-top:8px" id="security"></p>
  <p class="warn" id="warn"></p>
  <ol class="muted" id="steps"></ol>
  <a class="btn" id="dl" href="#">다시 받기</a>
  <script>
    (function () {
      var ua = navigator.userAgent || "";
      var platform = navigator.platform || "";
      var isMac = /Mac|Macintosh/i.test(platform) || (/Mac OS X/i.test(ua) && !/Windows NT/i.test(ua));
      var file = isMac ? "command" : "cmd";
      var os = isMac ? "mac" : "win";
      var filename = isMac ? "start-shotform-agent.command" : "start-shotform-agent.cmd";
      var cmdUrl = ${JSON.stringify(downloadBase)} + "?file=" + file + "&os=" + os + "&t=" + Date.now();

      document.getElementById("security").innerHTML = isMac
        ? "Chrome은 보안상 <b>.command를 자동으로 실행할 수 없습니다.</b><br/>다운로드 후 <b>더블클릭</b>하세요. 처음이면 「열 수 없음」→ 우클릭 → 열기."
        : "Chrome은 보안상 <b>.cmd를 자동으로 실행할 수 없습니다.</b><br/>그래서 파일을 받은 뒤 <b>직접 더블클릭</b>해야 에이전트 창이 열립니다.";

      document.getElementById("warn").innerHTML = isMac
        ? "Terminal에 Node.js not found 만 보이면 Node LTS를 설치한 뒤 이 파일을 다시 실행하세요."
        : "System32 창에 <b>'node'은(는) … 아닙니다</b> 만 보이면<br/>그건 <b>예전 설정</b>입니다. 그 창은 닫으세요.";

      document.getElementById("steps").innerHTML = isMac
        ? "<li>다운로드된 <b>" + filename + "</b> 를 더블클릭</li>" +
          "<li><b>Found: .../node</b> 가 보여야 정상</li>" +
          "<li><b>Starting agent</b> 후 이 안내 창은 닫아도 됩니다 (Terminal 창은 유지)</li>"
        : "<li>다운로드된 <b>" + filename + "</b> 를 더블클릭</li>" +
          "<li><b>Found: ...\\\\nodejs\\\\node.exe</b> 가 보여야 정상</li>" +
          "<li><b>Starting agent</b> 후 이 안내 창은 닫아도 됩니다 (에이전트 검은 창은 유지)</li>";

      var dl = document.getElementById("dl");
      dl.href = cmdUrl;
      dl.textContent = filename + " 다시 받기";

      var a = document.createElement("a");
      a.href = cmdUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      document.getElementById("msg").textContent =
        "파일은 이미 받았습니다. 다운로드 폴더에서 " + filename + " 를 더블클릭하세요. (이 화면은 안내입니다)";
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
