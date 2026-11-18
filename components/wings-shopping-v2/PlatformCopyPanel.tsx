'use client';
import { useState } from 'react';
import { patchProject } from '@/lib/wings-shopping-v2/client';
import { disclosureText, titlePrefix, type Affiliate } from '@/lib/wings-shopping-v2/publish/disclosure';
import { shotformOpenAiKey } from '@/lib/shotform-factory-seo';
import type { MvpSeoPlatformOutputs } from '@/lib/mvp-studio-types';
import type { PlatformCopy, PlatformCopyEntry, Project } from '@/lib/wings-shopping-v2/types';
import { Panel, PLATFORM_COLOR } from './ui';

type Key = 'youtube' | 'instagram' | 'tiktok';
type Field = keyof PlatformCopyEntry;
const PLATFORMS: { key: Key; label: string }[] = [
  { key: 'youtube', label: '유튜브 쇼츠' },
  { key: 'instagram', label: '인스타 릴스' },
  { key: 'tiktok', label: '틱톡' },
];
const FIELDS: { field: Field; label: string; rows: number; youtubeOnly?: boolean }[] = [
  { field: 'title', label: '제목', rows: 1, youtubeOnly: true },
  { field: 'description', label: '설명', rows: 7 },
  { field: 'tags', label: '태그 (해시태그)', rows: 2 },
  { field: 'comment', label: '고정 댓글', rows: 3 },
];
const EMPTY: PlatformCopyEntry = { description: '', tags: '', comment: '' };

/** 공용 SEO 생성기(/api/shotform-factory-seo) 결과 → 업로드 탭 3개 플랫폼 문구 */
function toPlatformCopy(po: MvpSeoPlatformOutputs, project: Project): PlatformCopy {
  const aff = (project.publish?.affiliate ?? 'none') as Affiliate;
  const notice = disclosureText(aff);
  const link = project.publish?.link?.trim();
  const join = (...parts: (string | undefined)[]) => parts.map((s) => s?.trim()).filter(Boolean).join('\n\n');
  const short = (s: MvpSeoPlatformOutputs['instagram']): PlatformCopyEntry => ({
    description: join(notice, s.body, s.cta),
    tags: s.hashtags.join(' '),
    comment: join(notice, s.commentPrompt),
  });
  const yt = po.youtube;
  return {
    youtube: {
      title: `${titlePrefix(aff)}${yt.title}`.slice(0, 100),
      description: join(notice, link && `구매 링크: ${link}`, yt.description),
      tags: yt.tags.join(', '),
      comment: join(notice, yt.pinnedComment, link && `구매 링크: ${link}`),
    },
    instagram: short(po.instagram),
    tiktok: short(po.tiktok),
    at: Date.now(),
  };
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn btn-ghost !px-2 !py-0.5 text-xs" disabled={!text.trim()}
      onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      {done ? '복사됨' : '복사'}
    </button>
  );
}

/** 업로드 탭: 플랫폼별 제목·설명·태그·고정 댓글 (AI 생성 + 직접 수정, blur 시 저장) */
export default function PlatformCopyPanel({ project, setProject }: { project: Project; setProject: (p: Project) => void }) {
  const [draft, setDraft] = useState<PlatformCopy>(project.platformCopy ?? {});
  const [tab, setTab] = useState<Key>('youtube');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const beats = project.script?.beats ?? [];
  const script = [...(project.script?.headcopy ?? []), ...beats.map((b) => b.text)]
    .map((t) => t.replace(/\n/g, ' ').trim()).filter(Boolean).join('\n');
  const duration = beats.reduce((s, b) => s + (b.tts?.duration ?? 0), 0);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/shotform-factory-seo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          apiKey: shotformOpenAiKey(),
          productName: project.analysis?.productName || project.name,
          referenceTitles: project.analysis?.keywords ?? [],
          script,
          videoDurationSec: duration || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; platformOutputs?: MvpSeoPlatformOutputs };
      if (!res.ok || !data.platformOutputs) throw new Error(data.error ?? `생성 실패 (${res.status})`);
      const next = toPlatformCopy(data.platformOutputs, project);
      setDraft(next);
      setProject(await patchProject(project.id, { platformCopy: next }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const entry = draft[tab] ?? EMPTY;
  const edit = (field: Field, value: string) => setDraft((d) => ({ ...d, [tab]: { ...(d[tab] ?? EMPTY), [field]: value } }));
  const save = async (field: Field) => {
    const value = entry[field] ?? '';
    if (value === (project.platformCopy?.[tab]?.[field] ?? '')) return;
    try {
      setProject(await patchProject(project.id, { platformCopy: { [tab]: { [field]: value } } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const hasAny = PLATFORMS.some((p) => draft[p.key]);

  return (
    <Panel title="플랫폼별 업로드 문구"
      actions={
        <button className="btn btn-primary" disabled={busy || !script} onClick={generate}>
          {busy ? '만드는 중...' : hasAny ? 'AI로 다시 생성' : 'AI로 생성'}
        </button>
      }>
      <div className="flex flex-col gap-4">
        <div role="tablist" aria-label="플랫폼" className="flex w-fit gap-1 rounded-xl border border-line bg-panel-2 p-1">
          {PLATFORMS.map((p) => (
            <button key={p.key} role="tab" aria-selected={tab === p.key} onClick={() => setTab(p.key)}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition-colors ${tab === p.key ? 'bg-panel font-semibold text-text shadow-sm' : 'text-muted hover:text-text'}`}>
              <span className="h-2 w-2 rounded-full" style={{ background: PLATFORM_COLOR[p.key] }} />
              {p.label}
            </button>
          ))}
        </div>
        {!script && <p className="text-sm text-muted">대본이 있어야 문구를 만들 수 있습니다.</p>}
        {script && !hasAny && !busy && (
          <p className="text-sm text-muted">AI로 생성을 누르면 대본과 제품 정보로 세 플랫폼 문구를 한 번에 씁니다. 결과는 직접 고칠 수 있고 자동 저장됩니다.</p>
        )}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <div className="grid gap-4">
          {FIELDS.filter((f) => !f.youtubeOnly || tab === 'youtube').map((f) => {
            const id = `pc-${tab}-${f.field}`;
            const value = entry[f.field] ?? '';
            return (
              <div key={id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor={id} className="text-xs font-medium text-muted">
                    {f.label}{f.field === 'title' && <span className="ml-1.5 text-muted/70">{value.length}/100</span>}
                  </label>
                  <CopyButton text={value} />
                </div>
                {f.rows === 1 ? (
                  <input id={id} className="field" maxLength={100} value={value}
                    onChange={(e) => edit(f.field, e.target.value)} onBlur={() => save(f.field)} />
                ) : (
                  <textarea id={id} className="field resize-y leading-relaxed" rows={f.rows} value={value}
                    onChange={(e) => edit(f.field, e.target.value)} onBlur={() => save(f.field)} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
