'use client';
import { useEffect, useRef, useState } from 'react';
import { api, frameUrl } from '@/lib/wings-shopping-v2/client';
import type { Project } from '@/lib/wings-shopping-v2/types';
import { Panel } from './ui';
import { ROLE_LABEL } from './SsulPanel';

const FLOW_URL = 'https://labs.google/fx/tools/flow';

export default function FlowPanel({ project, setProject }: { project: Project; setProject: (p: Project) => void }) {
  const [style, setStyle] = useState(project.flow?.style ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [veo, setVeo] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const beats = project.script?.beats ?? [];
  const prompts = project.flow?.prompts ?? {};

  useEffect(() => { api<{ veoAvailable: boolean }>(`/api/wings-shopping-v2/projects/${project.id}/flow/prompts`).then((r) => setVeo(r.veoAvailable)).catch(() => {}); }, [project.id]);

  async function makePrompts() {
    setBusy('prompts'); setError(null);
    try {
      setProject(await api<Project>(`/api/wings-shopping-v2/projects/${project.id}/flow/prompts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ style }) }));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  }
  async function upload(beatId: string, f: File) {
    setBusy(beatId); setError(null);
    const fd = new FormData(); fd.append('beatId', beatId); fd.append('file', f);
    const res = await fetch(`/api/wings-shopping-v2/projects/${project.id}/flow/clip`, { method: 'POST', body: fd });
    const j = await res.json().catch(() => ({}));
    if (res.ok) setProject(j as Project); else setError((j as { error?: string }).error ?? '업로드 실패');
    setBusy(null);
  }
  async function veoMake(beatId: string) {
    setBusy(beatId); setError(null);
    try { setProject(await api<Project>(`/api/wings-shopping-v2/projects/${project.id}/flow/veo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ beatId }) })); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  }
  async function copy(beatId: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(beatId); setTimeout(() => setCopied(null), 1500); } catch { /* 복사 실패는 무시 */ }
  }

  return (
    <Panel
      title="Flow AI 장면"
      actions={
        <>
          <a className="btn btn-ghost" href={FLOW_URL} target="_blank" rel="noreferrer">Flow 열기</a>
          <button className="btn btn-primary" disabled={!!busy || !beats.length} onClick={makePrompts}>
            {busy === 'prompts' ? '프롬프트 쓰는 중...' : Object.keys(prompts).length ? '프롬프트 다시 만들기' : 'Flow 프롬프트 만들기'}
          </button>
        </>
      }
    >
      <p className="-mt-2 mb-3 text-sm text-muted">
        맞는 장면이 없는 문장은 Google Flow로 만들어 붙이세요. 문장마다 Flow용 프롬프트를 만들고, Flow에서 받은 영상을 올리면 음성 길이에 맞춰 들어갑니다.
        실제 상품(그 호텔 객실, 그 투어 현장)을 AI로 지어내면 허위 광고가 되므로, AI 장면은 분위기·B롤에만 씁니다.
      </p>
      <label className="text-sm">
        <span className="text-muted">영상 스타일 (전체 공통)</span>
        <input className="field mt-1" value={style} maxLength={120} onChange={(e) => setStyle(e.target.value)} placeholder="예: 따뜻한 필름 톤, 여름 햇살, 브이로그 느낌" />
      </label>
      {veo ? <p className="mt-2 text-xs text-ok">이 키로 Veo를 쓸 수 있어 앱에서 바로 생성할 수도 있습니다.</p>
        : <p className="mt-2 text-xs text-muted">이 Gemini 키에는 Veo가 열려 있지 않아, Flow에서 만든 영상을 올리는 방식으로 씁니다.</p>}
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}

      {project.flow?.styleBible && <p className="mt-4 rounded-lg bg-ink px-3 py-2 text-xs text-muted">공통 스타일: {project.flow.styleBible}</p>}

      <ol className="mt-3 flex flex-col gap-2">
        {beats.map((b, i) => {
          const fp = prompts[b.id];
          const clip = project.clips.find((c) => c.id === b.clipId);
          return (
            <li key={b.id} className="grid grid-cols-[52px_1fr] gap-3 rounded-xl border border-line p-2.5">
              <div className="relative aspect-[9/16] w-[52px] overflow-hidden rounded-md bg-panel-2">
                {clip && <img src={frameUrl(project.id, clip.id)} alt="" className="h-full w-full object-cover" />}
                {clip?.aiGenerated && <span className="absolute bottom-0 inset-x-0 bg-amber text-center text-[10px] font-semibold text-amber-ink">AI</span>}
              </div>
              <div className="min-w-0 text-sm">
                <p><span className="mr-1.5 text-muted">{i + 1}{b.role ? ` · ${ROLE_LABEL[b.role] ?? b.role}` : ''}</span>{b.text.replace(/\n/g, ' ')}</p>
                {fp && (
                  fp.safe ? (
                    <div className="mt-1.5 flex flex-wrap items-start gap-2">
                      <code className="min-w-0 flex-1 rounded bg-ink px-2 py-1 text-[11px] leading-snug text-muted">{fp.text}</code>
                      <button className="btn btn-ghost !px-2.5 !py-1 text-xs" onClick={() => copy(b.id, fp.text)}>{copied === b.id ? '복사됨' : '복사'}</button>
                      <FileButton busy={busy === b.id} onFile={(f) => upload(b.id, f)} />
                      {veo && <button className="btn btn-ghost !px-2.5 !py-1 text-xs" disabled={!!busy} onClick={() => veoMake(b.id)}>Veo로 만들기</button>}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-xs text-amber">실제 상품 영상이 필요한 문장이라 AI 장면을 만들지 않습니다. {fp.note}</p>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function FileButton({ busy, onFile }: { busy: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <button className="btn btn-ghost !px-2.5 !py-1 text-xs" disabled={busy} onClick={() => ref.current?.click()}>{busy ? '올리는 중...' : 'Flow 영상 올리기'}</button>
    </>
  );
}
