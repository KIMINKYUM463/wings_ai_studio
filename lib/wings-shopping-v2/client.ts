'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project, Stage } from './types';

export const mediaUrl = (id: string, rel: string) => `/api/wings-shopping-v2/media/${id}/${rel}`;
export const frameUrl = (id: string, clipId: string) => mediaUrl(id, `frames/${clipId}.jpg`);
/** 좌우반전한 장면이면 미리보기도 뒤집는다 (CSS) */
export const flipStyle = (clip?: { flip?: boolean } | null): React.CSSProperties | undefined =>
  clip?.flip ? { transform: 'scaleX(-1)' } : undefined;
export const proxied = (url?: string) => (url ? `/api/wings-shopping-v2/image-proxy?url=${encodeURIComponent(url)}` : undefined);

export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `요청 실패 (${res.status})`);
  return data as T;
}

export const patchProject = (id: string, body: unknown) =>
  api<Project>(`/api/wings-shopping-v2/projects/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/**
 * 스테이지 시작. 같은 작업이 이미 돌고 있으면(409) 에러 대신 성공으로 본다.
 * 더블클릭·폴링 재시작으로 Next 오버레이가 뜨지 않게 한다.
 */
export const startStage = async (id: string, stage: Exclude<Stage, 'analyze'>, body?: Record<string, unknown>) => {
  await syncBrowserKeys();
  const res = await fetch(`/api/wings-shopping-v2/projects/${id}/${stage}`, {
    method: 'POST',
    ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 409) return { ok: true, alreadyRunning: true as const };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `요청 실패 (${res.status})`);
  return data as { ok: true };
};

async function syncBrowserKeys() {
  const jobs: Promise<Response>[] = [];
  const gemini = localStorage.getItem('shotform_gemini_api_key')?.trim();
  if (gemini) {
    jobs.push(fetch('/api/shotform/gemini-key', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey: gemini }),
    }));
  }
  const tikhub = localStorage.getItem('shotform_tikhub_api_key')?.trim();
  if (tikhub) {
    jobs.push(fetch('/api/shotform/tikhub-key', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey: tikhub }),
    }));
  }
  // 썰·리믹스 검색에서 YouTube 쇼츠를 가져오려면 Data API 키가 서버에 있어야 한다
  const youtube = localStorage.getItem('shotform_youtube_data_api_key')?.trim();
  if (youtube) {
    jobs.push(fetch('/api/shotform/youtube-key', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey: youtube }),
    }));
  }
  await Promise.all(jobs);
}

/** 프로젝트를 불러오고, 실행 중인 작업이 있으면 1초마다 다시 불러온다. */
export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const p = await api<Project>(`/api/wings-shopping-v2/projects/${id}`);
      setProject((prev) => (prev && JSON.stringify(prev) === JSON.stringify(p) ? prev : p));
      setError(null);
      return p;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [id]);

  useEffect(() => {
    void syncBrowserKeys();
  }, [id]);

  useEffect(() => {
    let alive = true;
    const loop = async () => {
      const p = await refresh();
      if (!alive) return;
      const running = p && Object.values(p.jobs).some((j) => j?.state === 'running');
      timer.current = setTimeout(loop, running ? 1000 : 4000);
    };
    loop();
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  return { project, setProject, error, refresh };
}

/**
 * 완성된 MP4를 브라우저 메모리(Blob URL)로 통째로 읽어와 재생 중 네트워크 Range 지연이나 버퍼링 끊김이 생기지 않게 한다.
 */
export function useBufferedVideoUrl(remoteUrl?: string | null): string | undefined {
  const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!remoteUrl) {
      setBlobUrl(undefined);
      return;
    }
    let cancelled = false;
    let createdObjectUrl: string | null = null;

    fetch(remoteUrl)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (cancelled || !blob || blob.size < 4096) return;
        createdObjectUrl = URL.createObjectURL(blob);
        setBlobUrl(createdObjectUrl);
      })
      .catch(() => {
        /* 실패 시 원본 URL 폴백 */
      });

    return () => {
      cancelled = true;
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl);
    };
  }, [remoteUrl]);

  return blobUrl ?? (remoteUrl || undefined);
}
