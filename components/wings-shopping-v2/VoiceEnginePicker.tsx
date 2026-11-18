'use client';
import { useEffect, useRef, useState } from 'react';
import { voicePersonaPhoto } from './VoiceFace';
import { MvpRemixVoiceField, type RemixVoiceSelection } from '@/app/WingsAIStudioShotForm/shortform-studio/MvpRemixVoiceField';
import { ttsProviderFromVoiceId, type TtsProviderId } from '@/lib/shotform-tts-providers';

type Engine = 'gemini' | TtsProviderId;
type Voice = { id: string; name: string };

const ENGINES: Array<{ id: Engine; label: string }> = [
  { id: 'gemini', label: '제미나이' },
  { id: 'typecast', label: '타입캐스트' },
  { id: 'elevenlabs', label: '일레븐랩스' },
  { id: 'supertonic', label: '수퍼토닉 3' },
  { id: 'adam', label: '아담' },
];
const GEMINI_SPEEDS = [0.9, 1.0, 1.1, 1.15, 1.2, 1.3];

/** 제미나이 목소리 미리듣기: 예시 한 문장을 그 목소리·속도로 들려준다 (처음 한 번만 만들고 저장) */
function PreviewButton({ voiceId, speed, mode, compact }: { voiceId: string; speed: number; mode?: string; compact?: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audio.current?.pause(); }, []);
  useEffect(() => { audio.current?.pause(); setState('idle'); }, [voiceId, speed]);
  async function toggle() {
    if (state === 'playing') { audio.current?.pause(); setState('idle'); return; }
    setState('loading');
    const a = new Audio(`/api/wings-shopping-v2/voice-preview?voiceId=${encodeURIComponent(voiceId)}&speed=${speed}&mode=${mode ?? ''}`);
    audio.current = a;
    a.onended = () => setState('idle');
    a.onerror = () => setState('error');
    a.onplaying = () => setState('playing');
    try { await a.play(); } catch { setState('error'); }
  }
  return (
    <button type="button" onClick={toggle} disabled={state === 'loading'}
      className={`flex ${compact ? 'h-8 w-full justify-center text-xs' : 'h-[42px] text-sm'} items-center gap-2 rounded-xl border px-4 font-semibold transition ${state === 'playing' ? 'border-[var(--amber)] bg-[color-mix(in_srgb,var(--amber)_8%,white)] text-[var(--amber)]' : 'border-line text-text hover:border-[var(--amber)]'}`}>
      {state === 'loading' ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <span aria-hidden>{state === 'playing' ? '❚❚' : '▶'}</span>}
      {state === 'loading' ? '목소리 준비 중' : state === 'playing' ? '멈춤' : state === 'error' ? '다시 듣기' : '미리듣기'}
    </button>
  );
}

/** 음성 엔진 고르기: 제미나이(기본 목소리 목록) 또는 스튜디오 목소리(타입캐스트·일레븐랩스·수퍼토닉 3·아담) */
export default function VoiceEnginePicker({
  voice,
  customVoice,
  geminiVoices,
  disabled,
  mode,
  onGemini,
  onCustom,
}: {
  voice: { voiceId: string; speed: number };
  customVoice?: RemixVoiceSelection;
  geminiVoices: Voice[];
  disabled?: boolean;
  /** 미리듣기 말투 (썰·여행·리뷰·리믹스) */
  mode?: string;
  onGemini: (voiceId: string, speed: number) => void;
  onCustom: (next: RemixVoiceSelection) => void;
}) {
  const savedEngine: Engine = (customVoice?.voiceId && ttsProviderFromVoiceId(customVoice.voiceId)) || 'gemini';
  const [engine, setEngine] = useState<Engine>(savedEngine);
  // 다른 엔진 버튼을 누르면 그 엔진 목록으로 선택 창을 바로 연다
  const [openKey, setOpenKey] = useState(0);
  const speeds = GEMINI_SPEEDS.includes(voice.speed) ? GEMINI_SPEEDS : [...GEMINI_SPEEDS, voice.speed].sort((a, b) => a - b);

  return (
    <div>
      <div role="radiogroup" aria-label="음성 엔진" className="inline-flex flex-wrap gap-1 rounded-2xl border border-line bg-panel-2 p-1">
        {ENGINES.map((e) => (
          <button
            key={e.id}
            type="button"
            role="radio"
            aria-checked={engine === e.id}
            disabled={disabled}
            onClick={() => {
              setEngine(e.id);
              if (e.id === 'gemini') {
                if (savedEngine !== 'gemini') onGemini('', voice.speed);
              } else {
                setOpenKey((k) => k + 1);
              }
            }}
            className={`rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-colors ${engine === e.id ? 'bg-white text-text shadow-sm ring-1 ring-line' : 'text-muted hover:text-text'}`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {engine === 'gemini' ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-muted">목소리</span>
            <select className="field mt-1 sm:min-w-56" disabled={disabled} value={savedEngine === 'gemini' ? voice.voiceId : ''} onChange={(ev) => onGemini(ev.target.value, voice.speed)}>
              <option value="">자동 선택</option>
              {geminiVoices.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-muted">속도</span>
            <select className="field mt-1" disabled={disabled} value={voice.speed} onChange={(ev) => onGemini(savedEngine === 'gemini' ? voice.voiceId : '', Number(ev.target.value))}>
              {speeds.map((s) => <option key={s} value={s}>{s.toFixed(2).replace(/0$/, '')}x</option>)}
            </select>
          </label>
          <PreviewButton voiceId={savedEngine === 'gemini' ? voice.voiceId : ''} speed={voice.speed} mode={mode} />
          {/* 제미나이 목소리 캐릭터: 사진 · 이름 · 듣기 */}
          <ul className="mt-1 grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {geminiVoices.map((v) => {
              const on = savedEngine === 'gemini' && voice.voiceId === v.id;
              const [nameEn, desc] = [v.name.split(' (')[0], v.name.match(/\((.+)\)/)?.[1] ?? ''];
              return (
                <li key={v.id} className={`rounded-2xl border-2 p-3 transition ${on ? 'border-[var(--amber)] bg-[color-mix(in_srgb,var(--amber)_6%,white)]' : 'border-line hover:border-[color-mix(in_srgb,var(--amber)_35%,var(--line))]'}`}>
                  <button type="button" disabled={disabled} onClick={() => onGemini(v.id, voice.speed)} className="flex w-full items-center gap-3 text-left">
                    <img src={voicePersonaPhoto(nameEn, desc)} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-text">{nameEn}</span>
                      <span className="block truncate text-[11px] text-muted">{desc}</span>
                    </span>
                  </button>
                  <div className="mt-2"><PreviewButton voiceId={v.id} speed={voice.speed} mode={mode} compact /></div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="mt-3">
          <MvpRemixVoiceField
            key={`${engine}-${openKey}`}
            tone="light"
            disabled={disabled}
            preferredProvider={engine}
            autoOpen={openKey > 0}
            value={customVoice?.voiceId && ttsProviderFromVoiceId(customVoice.voiceId) === engine ? customVoice : { voiceId: '', style: '', speed: customVoice?.speed ?? voice.speed }}
            onChange={onCustom}
            geminiTab={{
              voices: geminiVoices,
              selectedId: savedEngine === 'gemini' ? voice.voiceId : '',
              previewUrl: (id) => `/api/wings-shopping-v2/voice-preview?voiceId=${encodeURIComponent(id)}&speed=${voice.speed}&mode=${mode ?? ''}`,
              onApply: (id) => { setEngine('gemini'); onGemini(id, voice.speed); },
            }}
          />
        </div>
      )}
    </div>
  );
}
