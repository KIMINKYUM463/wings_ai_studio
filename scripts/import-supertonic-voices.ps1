# Supertonic 로컬 서버에 Voice Builder JSON import
# 사전: supertonic serve --host 127.0.0.1 --port 7788 --model supertonic-3

$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:7788"
$dir = Join-Path $PSScriptRoot "..\voices\supertonic" | Resolve-Path

$voices = @(
  @{ file = "yeoseong1.json"; name = "yeoseong1" },
  @{ file = "namseong1.json"; name = "namseong1" }
)

Write-Host "Health check..."
Invoke-RestMethod -Uri "$base/v1/health" -TimeoutSec 5 | Out-Host

foreach ($v in $voices) {
  $path = Join-Path $dir $v.file
  if (-not (Test-Path $path)) {
    Write-Warning "Missing: $path"
    continue
  }
  Write-Host "Import $($v.name) <- $($v.file)"
  curl.exe -s -X POST "$base/v1/styles/import?overwrite=true" `
    -F "file=@$path" `
    -F "name=$($v.name)"
  Write-Host ""
}

Write-Host "Styles:"
Invoke-RestMethod -Uri "$base/v1/styles" | ConvertTo-Json -Depth 5
