'use client';
import { useEffect, useState } from 'react';
import { patchProject } from '@/lib/wings-shopping-v2/client';
import type { SsulSettings } from '@/lib/wings-shopping-v2/types';
import { SSUL_FONTS } from '@/lib/wings-shopping-v2/templates/fonts';
import { Panel } from './ui';
import { TemplatePicker, TextScaleControls, loadSsulOptions, templatePreviewUrl } from './SsulPanel';
import type { StepProps } from './types';

type TemplateInfo = { id: string; name: string; family: string; description: string };

/** 제목 한 줄을 화면 상단 두 줄(headcopy)로 나눈다: 가운데에 가까운 띄어쓰기에서 자름 */
function splitTitle(title: string): [string, string] {
  const t = title.trim();
  const spaces = [...t.matchAll(/ /g)].map((m) => m.index ?? 0);
  if (t.length <= 14 || !spaces.length) return [t, ''];
  const cut = spaces.reduce((best, i) => (Math.abs(i - t.length / 2) < Math.abs(best - t.length / 2) ? i : best), spaces[0]);
  return [t.slice(0, cut).trim(), t.slice(cut + 1).trim()];
}

/** 영상 템플릿 단계: 스토리쇼핑숏폼(v1) 채널 화면 구성 — 현재 템플릿, 실시간 미리보기, 채널 정보, 표지, AI 후킹 제목 */
export default function TemplateStep({ project, setProject, goNext }: StepProps) {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [head, setHead] = useState<[string, string]>(project.script?.headcopy ?? ['', '']);
  const [titles, setTitles] = useState<string[]>([]);
  const [titleBusy, setTitleBusy] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [previewPoster, setPreviewPoster] = useState(true);
  const s = project.ssul;
  const mode = project.mode ?? 'ssul';

  useEffect(() => { loadSsulOptions(mode).then((o) => setTemplates(o.templates)).catch(() => {}); }, [mode]);
  useEffect(() => { setHead(project.script?.headcopy ?? ['', '']); }, [project.script?.headcopy]);
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickerOpen]);

  if (!s) return <Panel title="영상 템플릿"><p className="text-sm text-muted">썰 모드 프로젝트에서만 템플릿을 고를 수 있어요.</p></Panel>;

  const current = templates.find((t) => t.id === s.templateId);
  // 저장이 끝난 뒤에 화면을 바꾼다. 먼저 바꾸면 미리보기가 저장 전 설정으로 그려진 채 남는다
  const save = async (patch: Partial<SsulSettings>) => {
    setProject(await patchProject(project.id, { ssul: patch }));
  };
  const saveHead = async (next: [string, string]) => {
    setHead(next);
    if (!project.script) return;
    setProject(await patchProject(project.id, { headcopy: next }));
  };

  async function recommendTitles() {
    setTitleBusy(true);
    setTitleError('');
    try {
      const res = await fetch('/api/shotform/story-shopping/recommend-frame-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: project.analysis?.productName ?? project.name,
          templateName: current?.name ?? '',
          hook: project.script?.beats[0]?.text ?? '',
          script: (project.script?.beats ?? []).map((b) => b.text).join('\n'),
          apiKey: localStorage.getItem('shotform_openai_api_key') || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { titles?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error || '후킹 제목 추천에 실패했습니다.');
      setTitles(data.titles ?? []);
    } catch (e) {
      setTitleError(e instanceof Error ? e.message : '후킹 제목 추천에 실패했습니다.');
    } finally {
      setTitleBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel title="이야기 채널 화면을 먼저 정하세요" actions={<button className="btn btn-primary" onClick={goNext}>AI 자동편집으로</button>}>
        <p className="-mt-2 text-sm text-muted">고른 디자인이 모든 장면에 똑같이 들어가요. 미리보기는 실제로 만들어질 영상 화면 그대로예요.</p>
        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-amber/40 bg-amber/10 p-4">
          <img src={templatePreviewUrl(project, s.templateId)} alt="" className="aspect-[9/16] w-12 shrink-0 rounded-lg bg-black object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber">현재 선택</p>
            <p className="truncate text-base font-bold text-text">{current?.name ?? s.templateId}</p>
            {current?.description && <p className="truncate text-xs text-muted">{current.description}</p>}
          </div>
          <button type="button" className="btn btn-primary shrink-0" onClick={() => setPickerOpen(true)}>템플릿 선택</button>
        </div>
      </Panel>

      <Panel title="채널 정보 설정">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted">실시간 미리보기</p>
              {s.introPoster && (
                <div role="tablist" aria-label="미리보기 화면" className="inline-flex rounded-full border border-line bg-panel-2 p-0.5 text-xs">
                  {([[true, '첫 2초 표지'], [false, '본 장면']] as const).map(([v, label]) => (
                    <button key={label} type="button" role="tab" aria-selected={previewPoster === v} onClick={() => setPreviewPoster(v)}
                      className={`rounded-full px-2.5 py-1 font-semibold ${previewPoster === v ? 'bg-amber text-amber-ink' : 'text-muted hover:text-text'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* 휴대폰 모양 틀: 카메라 홈·홈 바는 테두리 안쪽 여백에 둬서 화면 내용을 가리지 않는다 */}
            <div className="mx-auto w-full max-w-[290px] rounded-[2.6rem] bg-[#16181d] px-2.5 pb-3 pt-2.5 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.55)] ring-1 ring-black/40">
              <div className="mb-2 flex justify-center" aria-hidden>
                <span className="h-[18px] w-24 rounded-full bg-black ring-1 ring-white/5" />
              </div>
              <img
                src={templatePreviewUrl(project, s.templateId, s.introPoster ? previewPoster : false)}
                alt={`${current?.name ?? '선택한 템플릿'} 미리보기`}
                className="aspect-[9/16] w-full rounded-[1.6rem] bg-black object-cover"
              />
              <div className="mt-2.5 flex justify-center" aria-hidden>
                <span className="h-1 w-24 rounded-full bg-white/40" />
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <p className="-mt-1 text-sm text-muted">입력한 정보는 모든 장면 상단에 똑같이 보여요.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-muted">채널명</span>
                <input className="field mt-1" defaultValue={s.channelName} maxLength={20}
                  onBlur={(e) => e.target.value !== s.channelName && save({ channelName: e.target.value })} />
              </label>
              <div className="text-sm">
                <span className="text-muted">영상 제목 (상단 두 줄)</span>
                <input className="field mt-1" value={head[0]} placeholder="첫째 줄" disabled={!project.script}
                  onChange={(e) => setHead([e.target.value, head[1]])} onBlur={() => saveHead(head)} />
                <input className="field mt-2" value={head[1]} placeholder="둘째 줄" disabled={!project.script}
                  onChange={(e) => setHead([head[0], e.target.value])} onBlur={() => saveHead(head)} />
                {!project.script && <span className="mt-1 block text-xs text-muted">대본을 만든 뒤에 바꿀 수 있어요.</span>}
              </div>
            </div>

            <div className="rounded-xl border border-line p-4">
              <p className="text-sm font-semibold text-text">자막 글꼴</p>
              <p className="text-xs text-muted">{project.lang ? '해외판은 언어에 맞는 글꼴을 자동으로 써요.' : '자막과 상단 글자에 모두 들어가요.'}</p>
              <style>{SSUL_FONTS.map((f) => `@font-face{font-family:'ssul-${f.id}';src:url('/fonts/${f.file}');font-display:swap}`).join('')}</style>
              {(['강조형', '깔끔형', '손글씨·감성형'] as const).map((g) => (
                <div key={g} className="mt-3">
                  <p className="mb-1.5 text-xs font-semibold text-muted">{g}</p>
                  <div className="flex flex-wrap gap-2">
                    {SSUL_FONTS.filter((f) => f.group === g).map((f) => {
                      const on = (s.font ?? 'pretendard') === f.id;
                      return (
                        <button key={f.id} type="button" aria-pressed={on} disabled={!!project.lang} onClick={() => !on && save({ font: f.id })}
                          style={{ fontFamily: `'ssul-${f.id}', sans-serif` }}
                          className={`rounded-lg border px-3 py-2 text-base disabled:opacity-50 ${on ? 'border-amber bg-amber/10 text-text' : 'border-line text-muted hover:border-muted hover:text-text'}`}>
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 제목·채널명·자막 글자 크기 (템플릿 선택 창 안에만 있어 찾기 어려웠음) */}
            <TextScaleControls project={project} setProject={setProject} />

            <div className="rounded-xl border border-line p-4">
              <p className="text-sm font-semibold text-text">영상 크기</p>
              <p className="text-xs text-muted">템플릿 안에서 영상이 차지하는 비율이에요.</p>
              <div role="radiogroup" aria-label="영상 크기" className="mt-3 grid grid-cols-3 gap-2">
                {([
                  ['default', '기본', '템플릿 그대로'],
                  ['square', '1:1', '정사각형'],
                  ['fill', '2:3', '아래까지 꽉 차게'],
                ] as const).map(([id, label, sub]) => {
                  const on = (s.videoFit ?? 'default') === id;
                  return (
                    <button key={id} type="button" role="radio" aria-checked={on} onClick={() => save({ videoFit: id })}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${on ? 'border-amber bg-amber/10' : 'border-line hover:border-muted'}`}>
                      <span aria-hidden className="grid h-10 w-7 shrink-0 place-items-end rounded-md border border-line bg-white p-0.5">
                        <span className="w-full rounded-sm bg-amber/70" style={{ height: id === 'default' ? '50%' : id === 'square' ? '56%' : '72%' }} />
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-text">{label}</span>
                        <span className="block text-[11px] text-muted">{sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel-2 p-4">
              <div>
                <p className="text-sm font-semibold text-text">영상 시작 표지</p>
                <p className="text-xs text-muted">첫 2초 동안 영상 제목을 크게 덮어서 보여줘요.</p>
              </div>
              <button type="button" role="switch" aria-checked={s.introPoster}
                onClick={() => { setPreviewPoster(true); void save({ introPoster: !s.introPoster }); }}
                className={`rounded-full px-4 py-1.5 text-sm font-bold ${s.introPoster ? 'bg-amber text-amber-ink' : 'border border-line text-muted'}`}>
                {s.introPoster ? '켜짐' : '꺼짐'}
              </button>
            </div>

            <div className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text">AI 후킹 제목</p>
                  <p className="text-xs text-muted">대본을 읽고 클릭을 부르는 제목을 추천해요. 고르면 위 영상 제목에 들어가요.</p>
                </div>
                <button type="button" className="btn btn-ghost" disabled={titleBusy || !project.script} onClick={recommendTitles}>
                  {titleBusy ? '추천 중...' : titles.length ? '다시 추천' : '후킹 제목 추천'}
                </button>
              </div>
              {titleError && <p className="mt-2 text-xs text-danger">{titleError}</p>}
              {titles.length > 0 && (
                <ul className="mt-3 grid gap-2">
                  {titles.map((t) => {
                    const on = head.join(' ').trim() === splitTitle(t).join(' ').trim();
                    return (
                      <li key={t}>
                        <button type="button" onClick={() => saveHead(splitTitle(t))}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${on ? 'border-amber bg-amber/10 font-semibold' : 'border-line hover:border-muted'}`}>
                          {t}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {pickerOpen && (
        <div role="dialog" aria-modal="true" aria-label="이야기 채널 템플릿 선택" className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onClick={() => setPickerOpen(false)}>
          <div className="max-h-[88vh] w-[min(96vw,72rem)] overflow-y-auto rounded-2xl bg-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-text">이야기 채널 템플릿 선택</h3>
                <p className="mt-1 text-sm text-muted">고른 디자인은 모든 장면에 똑같이 들어가요. 돋보기를 누르면 크게 볼 수 있어요.</p>
              </div>
              <button type="button" aria-label="닫기" className="rounded-full px-2 text-2xl leading-none text-muted hover:text-text" onClick={() => setPickerOpen(false)}>×</button>
            </div>
            <TemplatePicker project={project} setProject={setProject} hideHeading onPicked={() => setPickerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
