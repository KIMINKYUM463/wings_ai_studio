'use client';

import { useEffect, useRef, type SetStateAction } from 'react';
import { StoryThumbnailPanel } from '../story-shopping/StoryThumbnailPanel';
import {
  STORY_THUMBNAIL_TEMPLATES,
  isStoryThumbnailTemplateId,
} from '../story-shopping/story-thumbnail-templates';
import type { StoryShoppingBrief } from '../story-shopping/story-types';

type Props = {
  brief: StoryShoppingBrief;
  onChange: (next: StoryShoppingBrief) => void;
  projectId: string;
};

/** v2 내보내기 편집기 "썸네일 생성" 탭: 스타일 선택 + v1 썰쇼핑 썸네일 생성기 */
export default function V2ThumbnailTab({ brief, onChange, projectId }: Props) {
  // 패널이 함수형 업데이트를 연달아 보내도 최신 brief 기준으로 합치기 위해 ref 유지
  const latest = useRef(brief);
  useEffect(() => {
    latest.current = brief;
  }, [brief]);

  const apply = (action: SetStateAction<StoryShoppingBrief>) => {
    const next = typeof action === 'function' ? action(latest.current) : action;
    latest.current = next;
    onChange(next);
  };

  const savedStyle = brief.thumbnailState?.styleId ?? '';
  const styleId = isStoryThumbnailTemplateId(savedStyle) ? savedStyle : 'story-dark-yellow';

  const pickStyle = (id: string) =>
    apply((b) => ({
      ...b,
      thumbnailState: {
        gallery: b.thumbnailState?.gallery || [],
        selectedId: b.thumbnailState?.selectedId ?? null,
        ...b.thumbnailState,
        styleId: id,
      },
    }));

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-black text-text">썸네일 스타일</p>
        <p className="mt-1 text-xs text-text-muted">
          고른 스타일로 새 썸네일 초안과 상세 스튜디오가 열립니다.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {STORY_THUMBNAIL_TEMPLATES.map((tpl) => {
            const active = tpl.id === styleId;
            const hook2 = tpl.texts.find((t) => t.role === 'hook2')?.color;
            return (
              <button
                key={tpl.id}
                type="button"
                aria-pressed={active}
                onClick={() => pickStyle(tpl.id)}
                className={`rounded-xl border p-2 text-left transition ${
                  active ? 'border-amber bg-panel-2 ring-2 ring-amber' : 'border-line bg-panel hover:bg-panel-2'
                }`}
              >
                <div
                  className="relative mx-auto aspect-[9/16] w-full max-w-[64px] overflow-hidden rounded-md"
                  style={{ background: tpl.preview }}
                >
                  <div className="absolute inset-x-1 top-[4%] text-center text-[7px] font-black leading-tight text-white">
                    <p className="truncate">{tpl.sampleHook1}</p>
                    <p className="truncate" style={{ color: hook2 }}>
                      {tpl.sampleHook2}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs font-black text-text">{tpl.label}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-text-muted">{tpl.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-panel p-4">
        <StoryThumbnailPanel brief={brief} onChange={apply} projectId={projectId} templateId={styleId} />
      </section>
    </div>
  );
}
