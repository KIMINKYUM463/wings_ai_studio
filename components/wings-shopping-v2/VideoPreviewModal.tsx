'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/wings-shopping-v2/client';
import { extractYoutubeVideoId } from '@/lib/youtube-thumbnail';
import type { SearchResult } from '@/lib/wings-shopping-v2/types';
import { PLATFORM_COLOR, PLATFORM_LABEL } from './ui';

/** 플랫폼 공식 플레이어 주소 (유튜브·틱톡·인스타그램). 없으면 null → 원본 영상 주소를 받아 재생 */
function embedUrl(r: SearchResult): string | null {
  if (r.platform === 'youtube') {
    const id = extractYoutubeVideoId(r.url);
    return id ? `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0` : null;
  }
  if (r.platform === 'tiktok') {
    const id = r.url.match(/\/video\/(\d+)/)?.[1];
    return id ? `https://www.tiktok.com/embed/v2/${id}` : null;
  }
  if (r.platform === 'instagram') {
    const m = r.url.match(/\/(reel|reels|p)\/([^/?#]+)/);
    return m ? `https://www.instagram.com/${m[1] === 'p' ? 'p' : 'reel'}/${m[2]}/embed` : null;
  }
  return null;
}

/** 검색 결과 미리보기: 휴대폰 화면에서 재생하고, 바로 담거나 옆 영상으로 넘긴다 */
export default function VideoPreviewModal({ items, index, selected, onToggle, onMove, onClose }: {
  items: SearchResult[]; index: number; selected: boolean; onToggle: () => void; onMove: (i: number) => void; onClose: () => void;
}) {
  const r = items[index]!;
  const embed = embedUrl(r);
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSrc(null);
    setErr(null);
    if (embed) return;
    let alive = true;
    api<{ src: string }>(`/api/wings-shopping-v2/preview-url?url=${encodeURIComponent(r.url)}`)
      .then((d) => { if (alive) setSrc(d.src); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [r.url, embed]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < items.length - 1) onMove(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onMove(index - 1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [index, items.length, onClose, onMove]);

  return (
    <div role="dialog" aria-modal="true" aria-label="영상 미리보기" className="fixed inset-0 z-[80] grid place-items-center bg-[#0b0d14]/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-full items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="이전 영상" disabled={index === 0} onClick={() => onMove(index - 1)}
          className="hidden h-12 w-12 place-items-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 disabled:opacity-20 sm:grid">‹</button>

        <div className="flex flex-col items-center">
          {/* 휴대폰 */}
          <div className="rounded-[2.4rem] bg-[#16181d] px-2.5 pb-3 pt-2.5 shadow-2xl ring-1 ring-white/10" style={{ width: 'min(360px, calc((100vh - 170px) * 9 / 16 + 20px), 90vw)' }}>
            <div className="mb-2 flex justify-center" aria-hidden><span className="h-[18px] w-24 rounded-full bg-black" /></div>
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.8rem] bg-black">
              {embed ? (
                <iframe key={embed} src={embed} title={r.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full border-0" />
              ) : src ? (
                <video key={src} src={src} autoPlay controls playsInline loop className="absolute inset-0 h-full w-full object-contain" onError={() => setErr('영상을 불러오지 못했어요')} />
              ) : err ? (
                <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/80">
                  <div>
                    <p>{err}</p>
                    <a href={r.url} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0e1016]">원본에서 보기 ↗</a>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-white" aria-label="불러오는 중" />
                </div>
              )}
            </div>
            <div className="mt-2.5 flex justify-center" aria-hidden><span className="h-1 w-24 rounded-full bg-white/40" /></div>
          </div>

          {/* 정보 + 담기 */}
          <div className="mt-4 flex w-full max-w-[360px] items-center gap-3 text-white">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs text-white/60">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: PLATFORM_COLOR[r.platform] }} />{PLATFORM_LABEL[r.platform]} · {index + 1}/{items.length}
              </p>
              <p className="mt-0.5 line-clamp-1 text-sm font-semibold">{r.title}</p>
            </div>
            <button type="button" onClick={onToggle}
              className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-bold transition ${selected ? 'bg-white text-[#0e1016]' : 'bg-[var(--amber)] text-white hover:bg-[#4350ff]'}`}>
              {selected ? '✓ 담음' : '+ 담기'}
            </button>
          </div>
        </div>

        <button type="button" aria-label="다음 영상" disabled={index >= items.length - 1} onClick={() => onMove(index + 1)}
          className="hidden h-12 w-12 place-items-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 disabled:opacity-20 sm:grid">›</button>
      </div>
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute right-5 top-4 text-3xl leading-none text-white/70 hover:text-white">×</button>
    </div>
  );
}
