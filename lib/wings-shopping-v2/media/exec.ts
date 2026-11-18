import { spawn } from 'node:child_process';

export type ExecResult = { stdout: string; stderr: string };

/** 프로세스를 실행하고 종료 코드가 0이 아니면 stderr 마지막 줄들과 함께 거부한다. */
export function exec(cmd: string, args: string[], opts: { cwd?: string; timeoutMs?: number } = {}): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    // Windows 콘솔 기본 인코딩(cp949) 대신 UTF-8로 출력하게 한다 (yt-dlp 제목 한글 깨짐 방지)
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
    const child = spawn(cmd, args, { cwd: opts.cwd, windowsHide: true, env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => {
      stderr += d;
      if (stderr.length > 2_000_000) stderr = stderr.slice(-1_000_000);
    });
    const timer = opts.timeoutMs ? setTimeout(() => child.kill(), opts.timeoutMs) : null;
    child.on('error', (e) => { if (timer) clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} 실패 (code ${code}): ${stderr.split('\n').slice(-6).join('\n')}`));
    });
  });
}
