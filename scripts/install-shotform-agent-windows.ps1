# ShotForm 로컬 에이전트 — Windows 시작 프로그램 + shotform-agent:// 프로토콜 등록
# 사용: npm run shotform:install-agent

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$AgentScript = Join-Path $Root "scripts\shotform-local-agent.mjs"
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source

if (-not $Node) {
  Write-Error "node 를 찾지 못했습니다. Node.js를 설치한 뒤 다시 실행해 주세요."
}

if (-not (Test-Path $AgentScript)) {
  Write-Error "에이전트 스크립트 없음: $AgentScript"
}

# 시작 프로그램 바로가기
$Startup = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $Startup "ShotForm Local Agent.lnk"
$Wsh = New-Object -ComObject WScript.Shell
$Sc = $Wsh.CreateShortcut($ShortcutPath)
$Sc.TargetPath = $Node
$Sc.Arguments = "`"$AgentScript`""
$Sc.WorkingDirectory = $Root
$Sc.WindowStyle = 7
$Sc.Description = "ShotForm ffmpeg 로컬 렌더 에이전트"
$Sc.Save()

# shotform-agent://start 프로토콜 (배포 사이트에서 원클릭 기동)
$Proto = "shotform-agent"
$Base = "HKCU:\Software\Classes\$Proto"
New-Item -Path $Base -Force | Out-Null
Set-ItemProperty -Path $Base -Name "(Default)" -Value "URL:ShotForm Local Agent"
New-ItemProperty -Path $Base -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null
New-Item -Path "$Base\shell\open\command" -Force | Out-Null
$Cmd = "`"$Node`" `"$AgentScript`""
Set-ItemProperty -Path "$Base\shell\open\command" -Name "(Default)" -Value $Cmd

# 지금 바로 1회 실행
Start-Process -FilePath $Node -ArgumentList "`"$AgentScript`"" -WorkingDirectory $Root -WindowStyle Hidden

Write-Host ""
Write-Host "완료:"
Write-Host "  - 시작 프로그램 등록: $ShortcutPath"
Write-Host "  - 프로토콜 등록: shotform-agent://start"
Write-Host "  - 에이전트를 백그라운드에서 시작했습니다."
Write-Host ""
Write-Host "이제 배포 사이트에서 로컬 렌더를 선택하면 자동으로 연결을 시도합니다."
