import path from 'node:path';
import fs from 'node:fs/promises';
import { exec } from './exec';
import { FFMPEG, probeDuration } from './ffmpeg';
import { resolveDirectVideoUrl } from '../search/tikhub';

const PYTHON = process.env.PYTHON_PATH || 'python';

export function normalizeYoutubeUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/);
      if (m) id = m[2];
    }
  }
  if (!id || !/^[\w-]{6,}$/.test(id)) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

export function detectPlatform(url: string): 'youtube' | 'tiktok' | 'instagram' | 'douyin' | 'xiaohongshu' | 'other' {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return 'other';
  }
  if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return 'youtube';
  if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
  if (/(^|\.)douyin\.com$/.test(host)) return 'douyin';
  if (/(^|\.)(xiaohongshu\.com|xhslink\.com)$/.test(host)) return 'xiaohongshu';
  return 'other';
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

/** TikHub로 원본 mp4 주소를 받아 직접 내려받는다. 키가 없거나 주소를 못 찾으면 null */
async function downloadViaTikhub(url: string, outFile: string): Promise<{ file: string; duration: number } | null> {
  const direct = await resolveDirectVideoUrl(url);
  if (!direct) return null;
  const res = await fetch(direct.url, { headers: { referer: direct.referer, 'user-agent': UA } });
  if (!res.ok) throw new Error(`원본 영상 다운로드 실패 (${res.status})`);
  await fs.writeFile(outFile, Buffer.from(await res.arrayBuffer()));
  return { file: outFile, duration: await probeDuration(outFile) };
}

/** yt-dlp로 720p 이하 mp4를 받는다. */
export async function download(url: string, outFile: string): Promise<{ file: string; duration: number; title?: string }> {
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  const platform = detectPlatform(url);
  // 더우인·샤오홍슈는 yt-dlp가 막히므로 TikHub를 먼저 쓴다
  if (platform === 'douyin' || platform === 'xiaohongshu') {
    const r = await downloadViaTikhub(url, outFile);
    if (r) return r;
  }
  try {
    return await ytdlpDownload(url, outFile);
  } catch (e) {
    // TikTok 등에서 yt-dlp가 실패하면 TikHub로 한 번 더
    if (platform === 'tiktok') {
      const r = await downloadViaTikhub(url, outFile).catch(() => null);
      if (r) return r;
    }
    throw e;
  }
}

async function ytdlpDownload(url: string, outFile: string): Promise<{ file: string; duration: number; title?: string }> {
  const { stdout } = await exec(PYTHON, [
    '-m', 'yt_dlp', '--no-playlist', '--no-progress', '--no-warnings',
    '-f', 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b',
    '--merge-output-format', 'mp4', '--remux-video', 'mp4',
    '--ffmpeg-location', path.dirname(FFMPEG),
    '--print', 'after_move:title',
    '-o', outFile, url,
  ], { timeoutMs: 5 * 60_000 });
  const duration = await probeDuration(outFile);
  return { file: outFile, duration, title: stdout.trim().split('\n').pop() || undefined };
}
