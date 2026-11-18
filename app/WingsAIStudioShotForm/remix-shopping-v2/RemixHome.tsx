'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, frameUrl } from '@/lib/wings-shopping-v2/client';
import type { Project } from '@/lib/wings-shopping-v2/types';
import './remix-studio.css';

type Item = { id: string; name: string; createdAt: string; hasOutput: boolean; mode: string; lang?: string; cover?: string; stage: 'new' | 'analysis' | 'clips' | 'script' | 'done' };

const HERO_FRAMES = Array.from({ length: 10 }, (_, i) => `/remix-home/frame-${i}.jpg`);

const STEPS = [
  { name: 'AI 영상 분석', sub: '잘 된 숏폼의 훅과 흐름을 읽어요' },
  { name: '같은 상품 영상 찾기', sub: '여러 플랫폼에서 장면을 모아요' },
  { name: '영상 선택', sub: '쓸 장면만 골라요' },
  { name: 'AI 대본·음성', sub: '장면에 맞춰 대본과 목소리를 만들어요' },
  { name: '영상 템플릿', sub: '44가지 화면 디자인 중에 골라요' },
  { name: 'AI 자동편집', sub: '자막·효과음까지 한 번에 합쳐요' },
];
const STAGE: Record<Item['stage'], string> = { new: '분석 중', analysis: '영상 찾는 중', clips: '대본 쓰기 전', script: '편집 중', done: '완성' };

/** 붙여 넣은 주소가 어느 플랫폼인지 */
function platformOf(url: string): string | null {
  if (/youtu\.?be/.test(url)) return '유튜브';
  if (/tiktok/.test(url)) return '틱톡';
  if (/instagram/.test(url)) return '인스타그램';
  if (/douyin/.test(url)) return '더우인';
  if (/xiaohongshu|xhslink/.test(url)) return '샤오홍슈';
  return null;
}

/** 리믹스 ver2 홈: 참고 영상 주소 하나로 시작 + 내가 만든 리믹스 */
export default function RemixHome() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    api<Item[]>('/api/wings-shopping-v2/projects')
      .then((list) => setItems(list.filter((p) => p.mode === 'remix')))
      .catch(() => setItems([]));
  }, []);
  const platform = platformOf(url);
  const valid = /^https?:\/\//.test(url.trim());
  // 오른쪽 리믹스 장면: 샘플 쇼츠(public/remix-home)에서 캡처한 장면이 재료로 날아와 휴대폰 속 완성 영상이 된다
  const covers = HERO_FRAMES;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const p = await api<Project>('/api/wings-shopping-v2/projects', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: url.trim(), mode: 'remix' }),
      });
      router.push(`/WingsAIStudioShotForm/remix-shopping-v2/projects/${p.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="light-keep wings-shopping-v2 remix-atelier min-h-screen">

      <header className="mx-auto flex max-w-[1320px] items-center gap-5 px-6 pt-6 text-sm md:px-10">
        <Link href="/WingsAIStudioShotForm" className="font-semibold text-muted hover:text-text">← 메인으로</Link>
        <Link href="/WingsAIStudioShotForm?settings=open" className="text-muted hover:text-text">API 설정</Link>
        <span className="ml-auto flex items-center gap-2 rounded-full border border-line bg-white/80 px-3 py-1 text-xs font-semibold text-text backdrop-blur">
          <span className="ra-rec" aria-hidden /> AI 리믹스 쇼핑숏폼
        </span>
      </header>

      {/* 첫 화면 */}
      <section className="mx-auto grid max-w-[1320px] items-center gap-12 px-6 pb-12 pt-14 md:px-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-20">
        <div>
          <h1 className="text-[clamp(2.4rem,5.2vw,4.2rem)] font-bold leading-[1.06] tracking-[-0.035em] text-text">
            참고 영상 하나로,<br />새 쇼핑 숏폼을<br />편집해요.
          </h1>
          <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-muted">
            잘 된 숏폼 주소를 넣으면 AI가 구조를 읽고, 같은 상품 영상을 모아 장면을 다시 짜고, 대본·목소리·자막·효과음까지 맞춰요.
          </p>

          <form onSubmit={start} className="mt-10 max-w-[40rem]">
            <label htmlFor="rh-url" className="mb-2.5 flex items-center gap-2 px-1 text-[15px] font-bold text-text">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--amber)] text-xs text-white" aria-hidden>1</span>
              잘 된 숏폼 주소를 붙여 넣으세요
            </label>
            {/* 흐르는 그라데이션 테두리로 입력칸을 가장 먼저 보이게 */}
            <div className="rh-glow rounded-[26px] p-[2.5px] shadow-[0_30px_70px_-30px_rgba(47,59,235,0.7)]">
              <div className="flex items-center gap-2 rounded-[24px] bg-white p-2.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--amber)_10%,white)] text-xl" aria-hidden>🔗</span>
                <input id="rh-url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy} autoComplete="off" spellCheck={false} autoFocus
                  placeholder="https://youtube.com/shorts/..."
                  className="min-w-0 flex-1 bg-transparent px-2 py-3.5 text-lg font-medium text-text placeholder:font-normal placeholder:text-[#9aa0ad] focus:outline-none" />
                <button type="submit" disabled={!valid || busy}
                  className="shrink-0 rounded-[18px] bg-[var(--amber)] px-7 py-4 text-lg font-bold text-white shadow-[0_12px_28px_-10px_rgba(47,59,235,0.8)] transition hover:bg-[#4350ff] disabled:bg-[#8e95f5] disabled:shadow-none">
                  {busy ? '여는 중...' : '리믹스 시작 →'}
                </button>
              </div>
            </div>
            <p className="mt-3.5 flex flex-wrap items-center gap-1.5 px-1 text-sm text-muted" aria-live="polite">
              {platform ? <><span className="rounded-full bg-[color-mix(in_srgb,var(--amber)_10%,white)] px-3 py-1 font-semibold text-[var(--amber)]">{platform}</span> 영상을 분석할게요</> : (
                <>
                  {['유튜브', '틱톡', '인스타그램'].map((x) => <span key={x} className="rounded-full border border-line bg-white px-3 py-1 font-medium text-text">{x}</span>)}
                  <span className="ml-1">숏폼 주소를 받아요</span>
                </>
              )}
            </p>
            {error && <p className="mt-2 px-1 text-sm text-danger">{error}</p>}
          </form>
        </div>

        {/* 리믹스 장면: 재료 장면들이 휴대폰 화면으로 흘러 들어가 한 편이 된다 */}
        <div aria-hidden className="relative mx-auto h-[460px] w-full max-w-[540px]">
          <div className="absolute inset-x-0 bottom-6 h-16 overflow-hidden rounded-2xl bg-[#0e1016]">
            <div className="rh-conveyor flex h-full w-[200%] gap-2 px-2 py-2">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="h-full w-16 shrink-0 overflow-hidden rounded-md bg-[#232735]">
                  {covers.length ? <img src={covers[i % covers.length]} alt="" className="h-full w-full object-cover opacity-70" /> : null}
                </div>
              ))}
            </div>
            <span className="ra-holes top" /><span className="ra-holes bottom" />
          </div>
          {[0, 1, 2].map((k) => (
            <div key={k} className="rh-card absolute left-[4%] top-[14%] aspect-[9/16] w-[26%] overflow-hidden rounded-2xl bg-gradient-to-br from-[#c7cbf9] to-[#eef0ff] shadow-xl ring-1 ring-black/5"
              style={{ animationDelay: `${k * 2}s`, ['--r' as string]: `${(k - 1) * 5}deg`, top: `${10 + k * 6}%` }}>
              {covers[k] && <img src={covers[k]} alt="" className="h-full w-full object-cover" />}
            </div>
          ))}
          <div className="absolute right-[6%] top-0 aspect-[344/620] w-[46%] rounded-[2.2rem] border-[7px] border-[#0e1016] bg-[#0e1016] shadow-[0_40px_80px_-30px_rgba(14,16,22,0.6)]">
            <div className="relative h-full w-full overflow-hidden rounded-[1.7rem] bg-gradient-to-b from-[#1b1f2e] to-[#2f3beb]">
              <video src="/remix-home/hero.mp4" poster="/remix-home/poster.jpg" autoPlay muted loop playsInline preload="auto"
                className="absolute inset-0 h-full w-full bg-black object-contain" />
            </div>
          </div>
        </div>
      </section>

      {/* 과정 */}
      <section className="mx-auto max-w-[1320px] px-6 md:px-10">
        <div className="ra-strip light">
          <span className="ra-holes top" aria-hidden /><span className="ra-holes bottom" aria-hidden />
          <ol className="grid grid-cols-2 gap-2.5 py-2 sm:grid-cols-3 lg:grid-cols-6">
            {STEPS.map((s, i) => (
              <li key={s.name} className="flex gap-3 rounded-xl bg-[#f5f6fa] px-4 py-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--amber)] text-sm font-bold tabular-nums text-white">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold leading-snug text-text">{s.name}</p>
                  <p className="mt-1 text-[13px] leading-snug text-muted">{s.sub}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 내 리믹스 */}
      <section className="mx-auto max-w-[1320px] px-6 pb-20 pt-14 md:px-10">
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-text">내 리믹스</h2>
          {items && <span className="text-sm tabular-nums text-muted">{items.length}개</span>}
        </div>
        {items === null ? (
          <ul className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {[...Array(6)].map((_, i) => <li key={i} className="aspect-[9/16] animate-pulse rounded-2xl bg-[#e9ebf1]" />)}
          </ul>
        ) : items.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">아직 만든 리믹스가 없어요. 위에 참고 숏폼 주소를 넣어 시작해 보세요.</p>
        ) : (
          <ul className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {items.map((p) => (
              <li key={p.id}>
                <Link href={`/WingsAIStudioShotForm/remix-shopping-v2/projects/${p.id}`}
                  className="group block overflow-hidden rounded-2xl bg-[#0e1016] ring-1 ring-black/5 transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_50px_-24px_rgba(47,59,235,0.55)]">
                  <div className="relative aspect-[9/16] overflow-hidden">
                    {p.cover ? <img src={frameUrl(p.id, p.cover)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                      : <div className="h-full w-full bg-[repeating-linear-gradient(135deg,#1a1d26_0_10px,#20242f_10px_20px)]" />}
                    <span className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${p.stage === 'done' ? 'bg-white text-[#0e1016]' : 'bg-black/60 text-white backdrop-blur'}`}>{STAGE[p.stage]}</span>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-3 pt-10">
                      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-white">{p.name}</p>
                      <p className="mt-1 text-[11px] tabular-nums text-white/60">{new Date(p.createdAt).toLocaleDateString('ko-KR')}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
