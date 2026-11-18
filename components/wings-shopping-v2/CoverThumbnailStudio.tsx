'use client';
import { useEffect, useState } from 'react';
import { patchProject } from '@/lib/wings-shopping-v2/client';
import { COVER_VARIANTS } from '@/lib/wings-shopping-v2/templates/cover-variants';
import type { Project } from '@/lib/wings-shopping-v2/types';
import { templatePreviewUrl } from './SsulPanel';
import { PhoneFrame } from './StudioBits';

/**
 * 썸네일 스튜디오: 기본 썸네일 = 영상 첫 2초 표지(위 띠 + 큰 2줄 제목 + 첫 문장 줄).
 * 같은 구성에서 모양만 다른 변형을 골라 1080x1920 으로 내려받거나 영상 표지로 쓴다.
 */
export default function CoverThumbnailStudio({ project, setProject }: { project: Project; setProject: (p: Project) => void }) {
  const s = project.ssul;
  const pick = s?.coverVariant ?? 'dark';
  const [head, setHead] = useState<[string, string]>(project.script?.headcopy ?? ['', '']);
  useEffect(() => setHead(project.script?.headcopy ?? ['', '']), [project.script?.headcopy]);
  if (!s) return <p className="text-sm text-muted">썰 모드 프로젝트에서만 쓸 수 있어요.</p>;

  const url = (variant: string, hd = false) => `${templatePreviewUrl(project, s.templateId, true)}&cover=${variant}${hd ? '&hd=1' : ''}`;
  const picked = COVER_VARIANTS.find((v) => v.id === pick) ?? COVER_VARIANTS[0];
  const usedAsCover = !!s.introPoster;

  const saveHead = async (next: [string, string]) => {
    if (!project.script || next.join('|') === (project.script.headcopy ?? []).join('|')) return;
    setProject(await patchProject(project.id, { headcopy: next }));
  };
  // 모양을 고르면 바로 저장하고 영상 첫 화면 표지로도 쓴다 (표지는 아래 스위치로 끌 수 있음)
  const choose = async (id: string) => setProject(await patchProject(project.id, { ssul: { coverVariant: id, introPoster: true } }));
  const toggleCover = async () => setProject(await patchProject(project.id, { ssul: { coverVariant: pick, introPoster: !usedAsCover } }));

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <div className="flex flex-col items-center gap-3">
        <PhoneFrame src={url(pick)} alt={`${picked.name} 썸네일`} className="max-w-[280px]" />
        <a className="btn btn-primary w-full max-w-[280px] text-center" href={url(pick, true)} download={`thumbnail-${pick}.jpg`}>
          썸네일 내려받기 (1080×1920)
        </a>
        <button type="button" role="switch" aria-checked={usedAsCover} onClick={toggleCover}
          className={`flex w-full max-w-[280px] items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-semibold ${usedAsCover ? 'border-amber text-text' : 'border-line text-muted'}`}>
          영상 첫 2초에 이 썸네일 넣기
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${usedAsCover ? 'bg-amber text-amber-ink' : 'border border-line'}`}>{usedAsCover ? '켜짐' : '꺼짐'}</span>
        </button>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <h3 className="text-base font-bold text-text">썸네일 제목</h3>
          <p className="text-xs text-muted">영상 첫 화면 표지와 같은 제목이에요. 둘째 줄이 강조색으로 나와요.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input className="field" value={head[0]} placeholder="첫째 줄" disabled={!project.script}
              onChange={(e) => setHead([e.target.value, head[1]])} onBlur={() => saveHead(head)} />
            <input className="field" value={head[1]} placeholder="둘째 줄 (강조)" disabled={!project.script}
              onChange={(e) => setHead([head[0], e.target.value])} onBlur={() => saveHead(head)} />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ['coverBottomFill', '아래 빈 곳도 같은 색으로', '첫 문장 줄 아래부터 화면 끝까지 사진 위를 띠와 같은 색·투명도로 덮어요.'],
            ['coverZoom', '첫 문장 줄 줌인', '표지가 나오는 동안 첫 문장 줄이 천천히 커져요 (영상에서만 움직여요).'],
          ] as const).map(([key, label, sub]) => {
            const on = !!s[key];
            return (
              <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">{label}</p>
                  <p className="text-xs text-muted">{sub}</p>
                </div>
                <button type="button" role="switch" aria-checked={on}
                  onClick={async () => setProject(await patchProject(project.id, { ssul: { [key]: !on } }))}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold ${on ? 'bg-amber text-amber-ink' : 'border border-line text-muted'}`}>
                  {on ? '켜짐' : '꺼짐'}
                </button>
              </div>
            );
          })}
        </div>

        <div>
          <h3 className="text-base font-bold text-text">썸네일 모양</h3>
          <p className="text-xs text-muted">같은 제목·장면에서 띠 색과 강조색만 다르게 바꿔 봐요.</p>
          <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {COVER_VARIANTS.map((v) => {
              const on = v.id === pick;
              return (
                <li key={v.id}>
                  <button type="button" onClick={() => void choose(v.id)} aria-pressed={on} title={v.description}
                    className={`block w-full overflow-hidden rounded-xl border-2 bg-black text-left transition ${on ? 'border-amber shadow-md' : 'border-transparent hover:border-line'}`}>
                    <img src={url(v.id)} alt={`${v.name} 미리보기`} loading="lazy" className="aspect-[9/16] w-full object-cover" />
                  </button>
                  <p className={`mt-1.5 truncate text-xs ${on ? 'font-bold text-text' : 'text-muted'}`}>
                    {v.name}{on && s.introPoster ? ' · 표지' : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
