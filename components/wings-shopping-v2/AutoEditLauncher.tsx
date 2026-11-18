'use client';
import { projectTemplateId } from '@/lib/wings-shopping-v2/templates/catalog';
import { useEffect, useState } from 'react';
import { mediaUrl } from '@/lib/wings-shopping-v2/client';
import ExportEditor from './ExportEditor';
import { PhoneFrame } from './StudioBits';
import { templatePreviewUrl } from './SsulPanel';
import type { StepProps } from './types';

/** 자동편집 단계: "AI 자동편집" 을 누르면 화면 전체를 덮는 팝업에 편집기만 띄운다 */
export default function AutoEditLauncher(props: StepProps) {
  const { project } = props;
  const [open, setOpen] = useState(false);
  const beats = project.script?.beats ?? [];
  const total = beats.reduce((a, b) => a + (b.tts?.duration ?? 0), 0);
  const missing = beats.filter((b) => !b.tts || !b.clipId).length;
  const out = project.output;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // 안쪽 '크게 보기' 팝업이 열려 있으면 Esc 는 그것만 닫는다
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role=dialog][aria-label="크게 보기"], [role=dialog][data-state="open"]')) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <>
      <section className="grid gap-8 rounded-2xl border border-line bg-panel p-6 md:grid-cols-[220px_1fr] md:p-8">
        {projectTemplateId(project) ? (
          <PhoneFrame src={templatePreviewUrl(project, projectTemplateId(project)!, false)} alt="영상 미리보기" className="max-w-[220px]" />
        ) : <div />}
        <div className="flex min-w-0 flex-col justify-center">
          <p className="text-sm font-medium text-muted">AI 자동편집</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-text">{project.name}</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            AI가 고른 장면·자막·목소리·효과음이 타임라인에 맞춰 놓여 있어요. 편집기에서 장면을 바꾸거나 문장을 고친 뒤 영상을 만들 수 있어요.
          </p>
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div><dt className="text-muted">장면</dt><dd className="text-lg font-semibold text-text">{beats.length}개</dd></div>
            <div><dt className="text-muted">길이</dt><dd className="text-lg font-semibold tabular-nums text-text">{total.toFixed(1)}초</dd></div>
            <div><dt className="text-muted">완성 영상</dt><dd className="text-lg font-semibold text-text">{out && !out.stale ? '있음' : '아직 없음'}</dd></div>
          </dl>
          {missing > 0 && <p className="mt-3 text-sm text-danger">음성이나 장면이 빠진 문장이 {missing}개 있어요. 편집기에서 채울 수 있어요.</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary px-6 py-3 text-base" onClick={() => setOpen(true)}>AI 자동편집</button>
            {out && !out.stale && (
              <a className="btn btn-ghost px-5 py-3" href={`${mediaUrl(project.id, out.file)}?download`}>mp4 내려받기</a>
            )}
          </div>
        </div>
      </section>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="AI 자동편집" className={`wings-shopping-v2 fixed inset-0 z-[60] flex flex-col ${project.mode === 'remix' ? 'remix-atelier light-keep' : 'bg-[#f4f5f7]'}`}>
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line/70 bg-white/80 px-5 py-3 backdrop-blur">
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--amber)] text-sm text-white shadow-[0_8px_20px_-8px_var(--amber)]">✦</span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-amber">AI 자동편집</p>
                <p className="truncate text-sm font-bold text-text">{project.name}</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-1.5 text-sm font-semibold text-text shadow-sm transition hover:border-amber hover:text-amber">
              <span aria-hidden>✕</span> 닫기
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
            <div className="mx-auto max-w-[1600px]">
              <ExportEditor {...props} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
