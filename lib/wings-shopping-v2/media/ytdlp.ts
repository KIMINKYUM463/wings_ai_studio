import path from 'node:path';
import fs from 'node:fs/promises';
import { exec } from './exec';
import { FFMPEG, probeDuration } from './ffmpeg';
import { resolveDirectVideoUrl } from '../search/tikhub';
import { resolveTikhubVideo } from '@/lib/tikhub';
import { tikhubApiKey } from '../tikhub-key';
import { MULTI_USER } from '../request-ctx';

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

/** 유튜브: TikHub 로 영상 주소를 받아 내려받는다. 클라우드 PC 는 유튜브가 "봇 확인"으로 yt-dlp 를 막는다. */
async function downloadYoutubeViaTikhub(url: string, outFile: string): Promise<{ file: string; duration: number; title?: string }> {
  const key = tikhubApiKey();
  if (!key) throw new Error('TikHub API 키가 없습니다. 메인 화면 설정에서 TikHub 키를 저장해 주세요.');
  const row = await resolveTikhubVideo(key, url);
  if (!row?.videoUrl) throw new Error('TikHub 가 이 유튜브 영상 주소를 찾지 못했습니다.');
  const res = await fetch(row.videoUrl, { headers: { 'user-agent': UA, referer: 'https://www.youtube.com/' } });
  if (!res.ok) throw new Error(`유튜브 영상 다운로드 실패 (TikHub ${res.status})`);
  await fs.writeFile(outFile, Buffer.from(await res.arrayBuffer()));
  return { file: outFile, duration: await probeDuration(outFile), title: row.title };
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
  // 클라우드 PC(공용 모드)에서는 유튜브가 서버 IP 를 봇으로 막는다.
  // 주거용 프록시(YTDLP_PROXY)가 있으면 yt-dlp 가 그 프록시로 받고, 없으면 TikHub 로 시도한다
  if (platform === 'youtube' && MULTI_USER && !YTDLP_PROXY) {
    try {
      return await downloadYoutubeViaTikhub(url, outFile);
    } catch (e) {
      console.error('[v2 youtube tikhub]', e instanceof Error ? e.message : e);
      throw new Error(`유튜브 영상을 받지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  try {
    return await ytdlpDownload(url, outFile);
  } catch (e) {
    if (platform === 'youtube' && !MULTI_USER) {
      const r = await downloadYoutubeViaTikhub(url, outFile).catch(() => null);
      if (r) return r;
    }
    // TikTok 등에서 yt-dlp가 실패하면 TikHub로 한 번 더
    if (platform === 'tiktok') {
      const r = await downloadViaTikhub(url, outFile).catch(() => null);
      if (r) return r;
    }
    throw e;
  }
}

/** 유튜브 전용 주거용 프록시 (http://아이디:비번@주소:포트, 여러 개면 쉼표로 구분).
 *  주소를 받는 것과 내려받는 것이 같은 출구 IP 여야 해서 고정 IP 를 쓰고, 한 번 받을 때는 하나만 쓴다 */
const YTDLP_PROXIES = (process.env.YTDLP_PROXY ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const YTDLP_PROXY = YTDLP_PROXIES[0] ?? '';

/** 유튜브는 프록시 IP 마다 막힘 여부가 달라서, 막히면 다른 IP 로 최대 3번까지 다시 받는다 */
async function ytdlpDownload(url: string, outFile: string): Promise<{ file: string; duration: number; title?: string }> {
  if (!YTDLP_PROXY || detectPlatform(url) !== 'youtube') return ytdlpOnce(url, outFile, '');
  const order = [...YTDLP_PROXIES].sort(() => Math.random() - 0.5).slice(0, 3);
  let last: unknown;
  for (const p of order) {
    try {
      return await ytdlpOnce(url, outFile, p);
    } catch (e) {
      last = e;
      await fs.rm(outFile, { force: true }).catch(() => {});
    }
  }
  throw last;
}

async function ytdlpOnce(url: string, outFile: string, proxyUrl: string): Promise<{ file: string; duration: number; title?: string }> {
  const proxy = proxyUrl ? ['--proxy', proxyUrl] : [];
  const { stdout } = await exec(PYTHON, [
    '-m', 'yt_dlp', '--no-playlist', '--no-progress', '--no-warnings', ...proxy,
    // 클라우드 PC: 최신 yt-dlp 는 유튜브 서명 해석에 JS 런타임이 필요해 설치된 node 를 쓴다
    ...(MULTI_USER ? ['--js-runtimes', 'node'] : []),
    '-f', 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b',
    '--merge-output-format', 'mp4', '--remux-video', 'mp4',
    '--ffmpeg-location', path.dirname(FFMPEG),
    '--print', 'after_move:title',
    '-o', outFile, url,
  ], { timeoutMs: 5 * 60_000 });
  const duration = await probeDuration(outFile);
  return { file: outFile, duration, title: stdout.trim().split('\n').pop() || undefined };
}
