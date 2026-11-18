'use client';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { api } from '@/lib/wings-shopping-v2/client';
import { MODES, type ModeId } from '@/lib/wings-shopping-v2/modes';
import type { Project } from '@/lib/wings-shopping-v2/types';

export type StartPageProps = {
  /** 고정 모드면 라디오를 숨기고 이 모드로만 생성 */
  lockedMode?: ModeId;
  /** 상단 작은 알약 라벨 (v1과 동일 역할) */
  pill?: string;
  title: ReactNode;
  subtitle: string;
  /** 생성 후 이동할 프로젝트 경로 prefix (끝에 /projects 없음) */
  projectsBase: string;
};

const STEPS = ['영상 분석', '제품 찾기', '영상 선택', '대본·음성', '내보내기'] as const;

export default function StartPage({ lockedMode, pill, title, subtitle, projectsBase }: StartPageProps) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<ModeId>(lockedMode ?? 'remix');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modes = lockedMode ? MODES.filter((m) => m.id === lockedMode) : MODES;
  const lockedDesc = lockedMode ? MODES.find((m) => m.id === lockedMode)?.description : null;
  const pillLabel = pill ?? (lockedMode ? MODES.find((m) => m.id === lockedMode)?.name : '윙스쇼핑숏폼 버전2');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const p = await api<Project>('/api/wings-shopping-v2/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, mode: lockedMode ?? mode }),
      });
      router.push(`${projectsBase}/projects/${p.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <section className="v2-start">
      <div className="v2-start__glow" aria-hidden />
      <div className="v2-start__inner">
        <div className="v2-start__card">
          <div className="v2-start__pill">
            <span className="v2-start__pill-dot" aria-hidden />
            {pillLabel}
          </div>

          <h1 className="v2-start__title">{title}</h1>
          <p className="v2-start__subtitle">{subtitle}</p>

          {!lockedMode && (
            <fieldset className="v2-start__modes">
              <legend className="sr-only">만들 쇼츠 종류</legend>
              {modes.map(({ id, name, description: desc }) => (
                <label key={id} className={`v2-start__mode ${mode === id ? 'is-on' : ''}`}>
                  <input
                    type="radio"
                    name="mode"
                    value={id}
                    checked={mode === id}
                    onChange={() => setMode(id)}
                    className="sr-only"
                  />
                  <span className="v2-start__mode-name">{name}</span>
                  <span className="v2-start__mode-desc">{desc}</span>
                </label>
              ))}
            </fieldset>
          )}

          {lockedDesc && <p className="v2-start__hint">{lockedDesc}</p>}

          <form onSubmit={submit} className="v2-start__form">
            <label htmlFor="v2-url" className="sr-only">참고 쇼츠 주소</label>
            <input
              id="v2-url"
              className="field flex-1 text-base"
              placeholder="https://www.youtube.com/shorts/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              inputMode="url"
              autoFocus
            />
            <button className="btn btn-primary px-6" disabled={busy || !url.trim()}>
              {busy ? '시작하는 중…' : '분석 시작'}
            </button>
          </form>

          {error && (
            <p className="v2-start__error" role="alert">
              {error}
            </p>
          )}

          <ol className="v2-start__steps" aria-label="제작 단계">
            {STEPS.map((label, i) => (
              <li key={label} className="v2-start__step">
                <span className="v2-start__step-num">{i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
