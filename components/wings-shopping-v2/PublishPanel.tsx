'use client';
import { useState } from 'react';
import { api, mediaUrl, patchProject } from '@/lib/wings-shopping-v2/client';
import { AFFILIATES, onScreenText, type Affiliate } from '@/lib/wings-shopping-v2/publish/disclosure';
import type { Project } from '@/lib/wings-shopping-v2/types';
import { Panel } from './ui';

function CopyBox({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <button className="btn btn-ghost !px-2 !py-0.5 text-xs" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
          {done ? '복사됨' : '복사'}
        </button>
      </div>
      <pre className="whitespace-pre-wrap rounded-lg bg-panel-2 p-3 text-sm">{text}</pre>
    </div>
  );
}

/** 업로드 문구 + 광고·AI 표기 */
export default function PublishPanel({ project, setProject }: { project: Project; setProject: (p: Project) => void }) {
  const pub = project.publish ?? { affiliate: 'none' };
  const aff = pub.affiliate as Affiliate;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (patch: Record<string, unknown>) => setProject(await patchProject(project.id, { publish: patch }));
  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      setProject(await api<Project>(`/api/wings-shopping-v2/projects/${project.id}/publish`, { method: 'POST' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const pack = pub.pack;

  return (
    <Panel title="업로드 문구 · 광고 표기"
      actions={<button className="btn btn-primary" disabled={busy || !project.script?.beats.length} onClick={make}>{busy ? '쓰는 중...' : pack ? '다시 쓰기' : '업로드 문구 만들기'}</button>}>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-muted">광고·제휴</span>
          <select className="field !w-auto" value={aff} onChange={(e) => save({ affiliate: e.target.value })}>
            {AFFILIATES.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-muted">구매 링크</span>
          <input className="field min-w-[260px] flex-1" placeholder="https://link.coupang.com/... (비우면 '프로필 링크'로 안내)" defaultValue={pub.link ?? ''}
            onBlur={(e) => e.target.value !== (pub.link ?? '') && save({ link: e.target.value })} />
        </div>
        {aff !== 'none' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 text-muted">화면 문구</span>
            <input className="field min-w-[260px] flex-1" placeholder={onScreenText(aff)} defaultValue={pub.bannerText ?? ''}
              onBlur={(e) => e.target.value !== (pub.bannerText ?? '') && save({ bannerText: e.target.value })} />
          </div>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={pub.onScreen !== false} onChange={(e) => save({ onScreen: e.target.checked })} />
          <span>영상에 표기 넣기</span>
          <span className="text-muted">첫 3초 하단 배너 + 내내 오른쪽 위 [광고] 표시, AI 영상(Flow·Veo) 장면이 있으면 &apos;AI 생성 영상 포함&apos;</span>
        </label>
        <p className="text-xs text-muted">공정위 추천·보증 심사지침: 대가를 받은 홍보는 제목이나 첫 부분에 표시해야 합니다. 제목 앞 [광고], 설명·캡션·고정댓글 첫 줄 문구가 자동으로 들어갑니다. (법률 자문이 아닌 보수적 기본값)</p>
        {error && <p className="text-danger">{error}</p>}
        {pack && (
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <CopyBox label="YouTube 제목" text={pack.youtube.title} />
            <CopyBox label="YouTube 설명" text={pack.youtube.description} />
            <CopyBox label="Instagram 릴스 캡션" text={pack.instagram.caption} />
            <CopyBox label="TikTok 캡션" text={pack.tiktok.caption} />
            <CopyBox label="고정 댓글" text={pack.pinnedComment} />
            <div className="flex items-end"><a className="btn btn-ghost" href={`${mediaUrl(project.id, 'upload.txt')}?download&v=${pack.at}`}>upload.txt 내려받기</a></div>
          </div>
        )}
      </div>
    </Panel>
  );
}
