'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, patchProject } from '@/lib/wings-shopping-v2/client';
import type { Project, ReviewInfo, SsulSettings, TravelInfo } from '@/lib/wings-shopping-v2/types';
import { Panel } from './ui';
import ScriptFormulaPicker from './ScriptFormulaPicker';

export const ROLE_LABEL: Record<string, string> = {
  hook: '후킹', setup: '상황', conflict: '갈등', curiosity: '궁금증', product_intro: '상품 등장', feature: '기능', twist: '반전',
  reveal: '공개', proof: '증거', social_proof: '반응', usage: '사용', price: '가격', comparison: '비교', emotion: '감정', cta: '행동 유도', closing: '마무리',
  problem: '문제', rank_item: '상품 등장', demo: '시연', before: '비포', after: '애프터', con: '단점', verdict: '결론',
};

type Options = {
  productTypes: string[];
  structures: { id: string; name: string; oneLiner: string; whenToUse: string; evidence: string; roles: string[]; custom?: boolean }[];
  angles: { id: string; name: string; description: string }[];
  tones: { id: string; name: string; register: string; endings: string[]; example: string }[];
  ctaTypes: string[];
  families: { id: string; name: string; description: string }[];
  templates: {
    id: string; name: string; family: string; description: string;
    video?: { x: number; y: number; w: number; h: number };
    caption?: { x: number; y: number; align: number; maxWidth: number; size: number; color: string; outline?: number; outlineColor?: string; bold?: boolean; box?: { color: string; alpha?: number; pad?: number } };
    canvas?: string;
  }[];
};

const cached = new Map<string, Promise<Options>>();
/** 구조 복제 템플릿을 새로 저장하면 선택지를 다시 받는다 */
export const resetSsulOptions = () => cached.clear();

export const loadSsulOptions = (mode = 'ssul') => {
  if (!cached.has(mode)) {
    const req = api<Options>(`/api/wings-shopping-v2/ssul/options?mode=${mode}`);
    // 실패한 요청을 캐시에 남기면 새로고침 전까지 계속 "불러오는 중"이 된다 → 다음에 다시 받음
    req.catch(() => cached.delete(mode));
    cached.set(mode, req);
  }
  return cached.get(mode)!;
};

/** 템플릿 그림(레이아웃·표지)을 바꾸면 올린다 → 브라우저에 남은 옛 미리보기를 쓰지 않음 */
const PREVIEW_STYLE_VERSION = 's6'; // 템플릿 모양을 바꾸면 올린다 (브라우저가 1시간 캐시한 옛 미리보기를 새로 받게)

export function templatePreviewUrl(p: Project, templateId: string, poster?: boolean) {
  const v = encodeURIComponent([p.script?.headcopy?.join('|'), p.script?.beats[0]?.text, p.script?.comment, p.ssul?.channelName, p.script?.beats[0]?.clipId, p.ssul?.introPoster ? 'P' : '', p.ssul?.font ?? '', p.ssul?.videoFit ?? '', p.ssul?.coverBottomFill ? 'B' : '', p.ssul?.titleScale ?? 1, p.ssul?.channelScale ?? 1.5, PREVIEW_STYLE_VERSION].join('~'));
  const posterQuery = poster === undefined ? '' : `&poster=${poster ? 1 : 0}`;
  return `/api/wings-shopping-v2/projects/${p.id}/template-preview?templateId=${templateId}&v=${v}${posterQuery}`;
}

export default function SsulPanel({ project, setProject, hideTemplates }: { project: Project; setProject: (p: Project) => void; hideTemplates?: boolean }) {
  const [opts, setOpts] = useState<Options | null>(null);
  const s = project.ssul!;
  const travel = project.mode === 'travel';
  const review = project.mode === 'review';
  const mode = project.mode ?? 'ssul';
  useEffect(() => { loadSsulOptions(mode).then(setOpts).catch(() => {}); }, [mode]);
  const rinfo = project.reviewInfo ?? { items: '' };
  const saveReview = async (patch: Partial<ReviewInfo>) => {
    setProject({ ...project, reviewInfo: { ...rinfo, ...patch } });
    setProject(await patchProject(project.id, { reviewInfo: patch }));
  };
  const info = project.travelInfo ?? { productType: '' };
  const saveInfo = async (patch: Partial<TravelInfo>) => {
    setProject({ ...project, travelInfo: { ...info, ...patch } });
    setProject(await patchProject(project.id, { travelInfo: patch }));
  };
  const save = async (patch: Partial<SsulSettings>) => {
    setProject({ ...project, ssul: { ...s, ...patch } });
    setProject(await patchProject(project.id, { ssul: patch }));
  };
  const structure = opts?.structures.find((x) => x.id === s.structureId);
  const tone = opts?.tones.find((x) => x.id === s.toneId);

  const title = travel ? "여행 설정" : review ? "리뷰·랭킹 설정" : "썰 설정";
  if (!opts) {
    return (
      <Panel title={title}>
        <div className="grid gap-4" aria-busy="true" aria-label="설정 불러오는 중">
          <div className="h-32 animate-pulse rounded-2xl bg-panel-2" />
          <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-panel-2" />)}</div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={title}>
      <p className="-mt-2 mb-4 text-sm text-muted">{travel ? "상위 여행 쇼핑 쇼츠 80개를 문장 단위로 분석한 구조로 대본을 씁니다. 가격·기간은 아래에 입력한 것만 씁니다." : review ? "국내 36개 + 해외 20개 리뷰·랭킹·비교 쇼츠를 문장 단위로 분석한 구조로 씁니다. 상품마다 화면에 순위 배지와 상품명 카드가 뜹니다." : "상위 썰 쇼핑 쇼츠 117개를 문장 단위로 분석한 구조로 대본을 씁니다."}</p>
      {travel && (
        <div className="mb-5 grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm"><span className="text-muted">상품 종류</span>
            <select className="field mt-1" value={info.productType} onChange={(e) => saveInfo({ productType: e.target.value })}>
              <option value="">선택</option>{opts.productTypes.map((x) => <option key={x} value={x}>{x}</option>)}
            </select></label>
          {([["productName", "상품명", "예: 다낭 ○○ 리조트"], ["location", "지역 (화면 위치 핀)", "예: 다낭 미케비치"], ["price", "가격 (화면 가격표)", "예: 1박 9만원대"], ["period", "기간·마감", "예: 이번 달까지"], ["howToBuy", "예약·구매 방법", "예: 프로필 링크에서 예약"]] as const).map(([k, label, ph]) => (
            <label key={k} className="text-sm"><span className="text-muted">{label}</span>
              <input className="field mt-1" defaultValue={info[k] ?? ""} placeholder={ph} maxLength={60} onBlur={(e) => e.target.value !== (info[k] ?? "") && saveInfo({ [k]: e.target.value })} /></label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[var(--amber)]" checked={!!info.firsthand} onChange={(e) => saveInfo({ firsthand: e.target.checked })} />
            직접 이용·방문함 (체크 안 하면 체험담처럼 쓰지 않음)
          </label>
        </div>
      )}
      {review && (
        <div className="mb-5 grid gap-3 rounded-xl border border-line p-4">
          <label className="text-sm"><span className="text-muted">소개할 상품 (한 줄에 하나: 상품명 | 가격 | 한줄 특징 · 위에서부터 1위) — 비우면 레퍼런스 상품 하나로 리뷰형</span>
            <textarea className="field mt-1 min-h-[7rem] font-mono text-sm" defaultValue={rinfo.items} maxLength={1500}
              placeholder={'다이소 실리콘 냄비받침 | 2,000원 | 접어서 보관\n쿠팡 무선 미니청소기 | 29,900원 | 차량용 겸용\n올리브영 선스틱 | | 백탁 없음'}
              onBlur={(e) => e.target.value !== rinfo.items && saveReview({ items: e.target.value })} /></label>
          <label className="text-sm"><span className="text-muted">순위·추천 근거 (선택) — 비우면 &quot;판매량 기준&quot; 같은 근거를 대본에 넣지 않음</span>
            <input className="field mt-1" defaultValue={rinfo.basis ?? ''} maxLength={100} placeholder="예: 올리브영 랭킹 11월 기준 / 제 지성 피부 기준"
              onBlur={(e) => e.target.value !== (rinfo.basis ?? '') && saveReview({ basis: e.target.value })} /></label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[var(--amber)]" checked={!!rinfo.firsthand} onChange={(e) => saveReview({ firsthand: e.target.checked })} />
            직접 써본 상품 (체크 안 하면 내돈내산·사용 후기처럼 쓰지 않음)
          </label>
        </div>
      )}
      <ScriptFormulaPicker
        projectId={project.id}
        value={s.structureId}
        structures={opts.structures}
        roleLabel={ROLE_LABEL}
        autoReason={project.script?.structureReason}
        onChange={(structureId) => save({ structureId })}
      />

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <SettingTile label="썰 각도" hint={opts.angles.find((x) => x.id === s.angleId)?.description ?? '상품에 가장 흥미로운 각도를 AI가 정해요.'}>
          <TileSelect value={s.angleId} onChange={(v) => save({ angleId: v })}>
            <option value="">자동 (AI가 정함)</option>
            {opts.angles.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </TileSelect>
        </SettingTile>
        <SettingTile label="말투" hint={tone ? tone.endings.join(' · ') : ''}>
          <TileSelect value={s.toneId} onChange={(v) => save({ toneId: v })}>
            {opts.tones.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.register})</option>)}
          </TileSelect>
        </SettingTile>
        <SettingTile label="마무리" hint="영상 끝에서 시청자에게 할 말">
          <TileSelect value={s.ctaType} onChange={(v) => save({ ctaType: v })}>
            {opts.ctaTypes.map((x) => <option key={x} value={x}>{x}</option>)}
          </TileSelect>
        </SettingTile>
      </div>

      {s.ctaType === '댓글키워드' && (
        <label className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber/50 bg-[#fff8f1] px-5 py-3.5 focus-within:border-amber">
          <span className="text-sm font-medium text-muted">댓글 키워드</span>
          <input
            key={s.ctaKeyword ?? ''}
            className="min-w-[10rem] flex-1 bg-transparent text-base font-semibold text-text placeholder:text-muted focus:outline-none"
            defaultValue={s.ctaKeyword ?? ''}
            maxLength={20}
            placeholder="예: 싱크볼, 링크, 정보"
            onBlur={(e) => e.target.value.trim() !== (s.ctaKeyword ?? '') && save({ ctaKeyword: e.target.value.trim() })}
          />
          <span className="text-xs text-muted">{s.ctaKeyword ? `마지막에 "${s.ctaKeyword}" 댓글을 남기라고 말해요 · 대본 새로 쓰기에 반영` : '비우면 AI가 상품에 맞게 정해요'}</span>
        </label>
      )}

      {tone?.example && (
        <figure className="mt-4 rounded-2xl bg-panel-2 px-5 py-4">
          <figcaption className="text-xs font-medium text-muted">이 말투로 쓰면</figcaption>
          <blockquote className="mt-1.5 text-sm leading-relaxed text-text">{tone.example}</blockquote>
        </figure>
      )}

      <label className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line px-5 py-3.5 focus-within:border-amber">
        <span className="text-sm font-medium text-muted">채널명</span>
        <input
          className="min-w-[12rem] flex-1 bg-transparent text-base font-semibold text-text placeholder:text-muted focus:outline-none"
          defaultValue={s.channelName}
          maxLength={20}
          placeholder="화면 상단에 보일 채널 이름"
          onBlur={(e) => e.target.value !== s.channelName && save({ channelName: e.target.value })}
        />
        <span className="text-xs text-muted">영상 상단에 표시돼요</span>
      </label>

      {!hideTemplates && <TemplatePicker project={project} setProject={setProject} />}
    </Panel>
  );
}

/** 템플릿 제목·채널명 글자 크기 (60~200%) */
function TextScaleControls({ project, setProject }: { project: Project; setProject: (p: Project) => void }) {
  const rows = [
    { key: 'titleScale' as const, label: '제목 크기' },
    { key: 'channelScale' as const, label: '채널명 크기' },
  ];
  const [vals, setVals] = useState(() => ({ titleScale: project.ssul?.titleScale ?? 1, channelScale: project.ssul?.channelScale ?? 1.5 }));
  const save = async (k: 'titleScale' | 'channelScale', v: number) => {
    if (v === (project.ssul?.[k] ?? (k === 'channelScale' ? 1.5 : 1))) return;
    setProject(await patchProject(project.id, { ssul: { [k]: v } }));
  };
  // −/+ 를 연달아 누르면 마지막 값만 0.4초 뒤 저장 (누를 때마다 미리보기를 다시 그리지 않게)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const set = (k: 'titleScale' | 'channelScale', v: number, delay = 0) => {
    const next = Math.round(Math.min(2, Math.max(0.6, v)) * 100) / 100;
    setVals((s) => ({ ...s, [k]: next }));
    clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(() => void save(k, next), delay);
  };
  const stepBtn = 'grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-base font-bold text-text transition hover:border-amber hover:text-amber disabled:opacity-40';
  return (
    <div className="mt-4 grid gap-3 rounded-2xl border border-line px-5 py-4 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 text-sm">
          <span className="w-20 shrink-0 font-medium text-muted">{r.label}</span>
          <button type="button" className={stepBtn} aria-label={`${r.label} 1% 줄이기`} disabled={vals[r.key] <= 0.6} onClick={() => set(r.key, vals[r.key] - 0.01, 400)}>−</button>
          <input type="range" min={0.6} max={2} step={0.01} value={vals[r.key]} className="min-w-0 flex-1 accent-[var(--amber)]" aria-label={r.label}
            onChange={(e) => setVals((s) => ({ ...s, [r.key]: Number(e.target.value) }))}
            onPointerUp={(e) => set(r.key, Number(e.currentTarget.value))}
            onKeyUp={(e) => set(r.key, Number(e.currentTarget.value), 400)} />
          <button type="button" className={stepBtn} aria-label={`${r.label} 1% 키우기`} disabled={vals[r.key] >= 2} onClick={() => set(r.key, vals[r.key] + 0.01, 400)}>+</button>
          <span className="w-11 text-right tabular-nums text-text">{Math.round(vals[r.key] * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

/** 영상 템플릿 고르기 (썰 설정 안 또는 별도 단계). 미리보기마다 확대 버튼이 있다 */
export function TemplatePicker({ project, setProject, hideHeading, onPicked }: { project: Project; setProject: (p: Project) => void; hideHeading?: boolean; onPicked?: () => void }) {
  const [opts, setOpts] = useState<Options | null>(null);
  const [family, setFamily] = useState<string>('all');
  const [zoomId, setZoomId] = useState<string | null>(null);
  const s = project.ssul!;
  const mode = project.mode ?? 'ssul';
  useEffect(() => { loadSsulOptions(mode).then(setOpts).catch(() => {}); }, [mode]);
  useEffect(() => {
    if (!zoomId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomId]);
  const save = async (patch: Partial<SsulSettings>) => {
    setProject({ ...project, ssul: { ...s, ...patch } });
    setProject(await patchProject(project.id, { ssul: patch }));
  };
  const shown = useMemo(() => (opts?.templates ?? []).filter((t) => family === 'all' || t.family === family), [opts, family]);
  if (!opts) return <p className="mt-6 text-sm text-muted">템플릿 불러오는 중...</p>;
  const familyName = (id: string) => opts.families.find((f) => f.id === id)?.name;
  const zoomed = opts.templates.find((t) => t.id === zoomId);

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {hideHeading ? <span /> : <h3 className="font-display text-xl">영상 템플릿</h3>}
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--amber)]" checked={s.introPoster} onChange={(e) => save({ introPoster: e.target.checked })} />
          첫 2초 큰 제목(포스터 인트로) 추가
        </label>
      </div>
      <TextScaleControls project={project} setProject={setProject} />
      <div className="mt-3 flex flex-wrap gap-1" role="tablist">
        {[{ id: 'all', name: '전체' }, ...opts.families].map((f) => (
          <button key={f.id} role="tab" aria-selected={family === f.id} onClick={() => setFamily(f.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${family === f.id ? 'bg-panel-2 text-text' : 'text-muted hover:text-text'}`}>
            {f.name}
          </button>
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map((t) => {
          const on = s.templateId === t.id;
          return (
            <li key={t.id} className="relative">
              <button onClick={() => { void save({ templateId: t.id }); onPicked?.(); }} aria-pressed={on} title={t.description}
                className={`block w-full overflow-hidden rounded-xl border-2 bg-ink text-left ${on ? 'border-amber' : 'border-transparent hover:border-line'}`}>
                <img src={templatePreviewUrl(project, t.id, false)} alt={`${t.name} 템플릿 미리보기`} loading="lazy" className="aspect-[9/16] w-full object-cover" />
                <span className="block truncate px-2 py-1.5 text-xs">{familyName(t.family)} · {t.name}</span>
              </button>
              <button
                type="button"
                onClick={() => setZoomId(t.id)}
                aria-label={`${t.name} 크게 보기`}
                title="크게 보기"
                className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-[#18181b] shadow-md ring-1 ring-black/10 hover:bg-amber hover:text-amber-ink"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5M11 8.5v5M8.5 11h5" /></svg>
              </button>
            </li>
          );
        })}
      </ul>
      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${zoomed.name} 템플릿 크게 보기`}
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"
          onClick={() => setZoomId(null)}
        >
          <div className="flex max-h-full flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <img
              src={templatePreviewUrl(project, zoomed.id, false)}
              alt={`${zoomed.name} 템플릿 미리보기`}
              className="aspect-[9/16] h-[min(78vh,760px)] rounded-2xl bg-black object-contain shadow-2xl"
            />
            <p className="text-sm font-semibold text-white">{familyName(zoomed.family)} · {zoomed.name}</p>
            <div className="flex gap-2">
              <button className="btn btn-ghost bg-white text-[#18181b]" onClick={() => setZoomId(null)}>닫기</button>
              <button className="btn btn-primary" onClick={() => { void save({ templateId: zoomed.id }); setZoomId(null); onPicked?.(); }}>
                {s.templateId === zoomed.id ? '선택됨' : '이 템플릿 쓰기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** 썰 설정 칸: 작은 라벨 + 큰 값 + 설명. 칸 전체가 포커스를 받는다 */
function SettingTile({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-white px-5 py-4 transition focus-within:border-amber focus-within:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{hint}</span>}
    </div>
  );
}

/** 테두리 없는 큰 선택 상자 (오른쪽 화살표) */
function TileSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative mt-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none truncate bg-transparent py-1 pr-7 text-base font-semibold text-text focus:outline-none"
      >
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m5 8 5 5 5-5" /></svg>
    </div>
  );
}
