'use client';
import { useMemo, useState } from 'react';
import { api, mediaUrl, patchProject } from '@/lib/wings-shopping-v2/client';
import { BGM_MOODS } from '@/lib/wings-shopping-v2/audio/moods';
import { fxSettings, previewBgmVolume } from '@/lib/wings-shopping-v2/audio/settings';
import {
  mvpAudioCatalogItem,
  mvpBgmDisplayName,
  mvpBgmPickerItems,
} from '@/lib/mvp-studio-audio-catalog';
import type { FxSettings, Project } from '@/lib/wings-shopping-v2/types';
import { Panel } from './ui';
import { MOTION_PRESETS, SFX_PRESETS } from '@/lib/wings-shopping-v2/fx-presets';

/** 배경음악·효과음·모션그래픽 설정 */
export default function FxPanel({ project, setProject }: { project: Project; setProject: (p: Project) => void }) {
  const fx = fxSettings(project);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ file: string; at: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catalogItems = useMemo(() => mvpBgmPickerItems(), []);
  const selectedCatalog = fx.bgmTrackId ? mvpAudioCatalogItem(fx.bgmTrackId) : null;
  const selectedName = fx.bgmTrackId ? mvpBgmDisplayName(fx.bgmTrackId) : null;

  const save = async (patch: Partial<FxSettings>) => setProject(await patchProject(project.id, { fx: patch }));
  const listen = async (regenerate = false) => {
    setBusy(true);
    setError(null);
    try {
      setPreview(await api<{ file: string; at: number }>(`/api/wings-shopping-v2/projects/${project.id}/bgm`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mood: fx.mood, regenerate }),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="배경음악 · 효과음 · 모션">
      <div className="flex flex-col gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={fx.bgm} onChange={(e) => save({ bgm: e.target.checked })} />
          <span className="font-medium">배경음악</span>
          <span className="text-muted">나레이션이 나올 땐 자동으로 작아집니다</span>
        </label>
        {fx.bgm && (
          <div className="ml-6 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn ${!fx.bgmTrackId ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => void save({ bgmTrackId: '' })}
              >
                AI 새로 작곡
              </button>
              <button
                type="button"
                className={`btn ${fx.bgmTrackId ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  const first = catalogItems[0]?.id ?? '';
                  if (!fx.bgmTrackId && first) void save({ bgmTrackId: first });
                }}
              >
                내장 배경음악 고르기
              </button>
            </div>

            {!fx.bgmTrackId ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {BGM_MOODS.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      className={`btn ${fx.mood === m.id ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => { setPreview(null); void save({ mood: m.id, bgmTrackId: '' }); }}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => listen(false)}>
                    {busy ? '작곡 중... (20~40초)' : '미리듣기'}
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => listen(true)}>
                    다른 곡으로 새로 만들기
                  </button>
                  {preview && (
                    <audio key={preview.at} src={`${mediaUrl(project.id, preview.file)}?v=${preview.at}`} controls autoPlay data-bgm-preview className="h-9" ref={(el) => { if (el) el.volume = fx.bgmVolume; }} />
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-panel-2/40 p-3">
                <div className="flex flex-wrap gap-1.5">
                  {catalogItems.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`btn !px-3 !py-1.5 !text-xs ${fx.bgmTrackId === item.id ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => void save({ bgmTrackId: item.id })}
                    >
                      {item.shortLabel}
                    </button>
                  ))}
                </div>
                {selectedCatalog && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted">
                      선택됨: {selectedName ?? selectedCatalog.shortLabel}
                    </span>
                    {/* 미리듣기도 크기 슬라이더 값으로 (영상에 섞이는 크기와 같게) */}
                    <audio key={selectedCatalog.id} src={selectedCatalog.src} controls data-bgm-preview className="h-8 max-w-[260px]"
                      ref={(el) => { if (el) el.volume = fx.bgmVolume; }} />
                  </div>
                )}
              </div>
            )}

            <label className="flex items-center gap-3">
              <span className="w-16 text-muted">크기</span>
              <input
                type="range"
                min={0.05}
                max={0.4}
                step={0.01}
                defaultValue={fx.bgmVolume}
                key={fx.bgmVolume}
                onInput={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  document.querySelectorAll<HTMLAudioElement>('audio[data-bgm-preview]').forEach((a) => { a.volume = v; });
                  // 편집기 미리보기 재생 중인 배경음악도 바로 따라 바뀌게
                  document.querySelectorAll<HTMLAudioElement>('audio[data-bgm-editor]').forEach((a) => { a.volume = previewBgmVolume(v); });
                }}
                onKeyUp={(e) => save({ bgmVolume: Number((e.target as HTMLInputElement).value) })}
                onMouseUp={(e) => save({ bgmVolume: Number((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => save({ bgmVolume: Number((e.target as HTMLInputElement).value) })}
              />
              <span className="tabular-nums text-muted">{Math.round(fx.bgmVolume * 100)}%</span>
            </label>
            {error && <p className="text-danger">{error}</p>}
          </div>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={fx.sfx} onChange={(e) => save({ sfx: e.target.checked })} />
          <span className="font-medium">효과음 자동 삽입</span>
          <span className="text-muted">템플릿을 고르면 미리보기에 바로 들려요</span>
        </label>
        {fx.sfx && (
          <div className="ml-6 flex flex-wrap gap-1.5">
            {SFX_PRESETS.map((x) => (
              <button key={x.id} type="button" title={x.description} aria-pressed={fx.sfxPreset === x.id}
                className={`btn !px-3 !py-1.5 !text-xs ${fx.sfxPreset === x.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => void save({ sfxPreset: x.id })}>
                {x.name}
              </button>
            ))}
            <span className="self-center text-xs text-muted">{SFX_PRESETS.find((x) => x.id === fx.sfxPreset)?.description}</span>
            <ReshuffleButton onClick={() => void save({ seed: Math.floor(Math.random() * 99999) + 1 })} />
          </div>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={fx.motion} onChange={(e) => save({ motion: e.target.checked })} />
          <span className="font-medium">모션그래픽</span>
          <span className="text-muted">템플릿을 고르면 미리보기에 바로 보여요</span>
        </label>
        {fx.motion && (
          <div className="ml-6 flex flex-wrap gap-1.5">
            {MOTION_PRESETS.map((x) => (
              <button key={x.id} type="button" title={x.description} aria-pressed={fx.motionPreset === x.id}
                className={`btn !px-3 !py-1.5 !text-xs ${fx.motionPreset === x.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => void save({ motionPreset: x.id })}>
                {x.name}
              </button>
            ))}
            <span className="self-center text-xs text-muted">{MOTION_PRESETS.find((x) => x.id === fx.motionPreset)?.description}</span>
            <ReshuffleButton onClick={() => void save({ seed: Math.floor(Math.random() * 99999) + 1 })} />
          </div>
        )}
      </div>
    </Panel>
  );
}

/** 효과음·모션 조합 다시 뽑기 (같은 자리에 다른 소리·전환 모양) */
function ReshuffleButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="같은 템플릿으로 다른 효과음·전환 조합을 만들어요"
      className="ml-auto flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-text transition hover:border-amber hover:text-amber">
      <span aria-hidden>↻</span> 다시 만들기
    </button>
  );
}
