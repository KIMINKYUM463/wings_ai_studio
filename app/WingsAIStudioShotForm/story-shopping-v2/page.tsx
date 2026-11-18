'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import '../wings-shopping-v2/wings-shopping-v2.css';
import {
  ArrowLeft,
  ArrowRight,
  FolderOpen,
  Home,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ProjectWorkspace from '@/components/wings-shopping-v2/ProjectWorkspace';
import { STEPS as V2_STEPS } from '@/components/wings-shopping-v2/ui';
import { startStage } from '@/lib/wings-shopping-v2/client';
import type { Project } from '@/lib/wings-shopping-v2/types';
import { StoryWinningContentPanel } from '../story-shopping/StoryWinningContentPanel';
import { StoryProductSearchPanel } from '../story-shopping/StoryProductSearchPanel';
import V2ThumbnailTab from './V2ThumbnailTab';
import {
  createShoppingProject,
  deleteShoppingProject,
  getShoppingProjects,
  updateShoppingProject,
  type ShoppingProject,
} from '../story-shopping/project-actions';
import {
  EMPTY_STORY_BRIEF,
  type StoryShoppingBrief,
  type StoryWinningContent,
} from '../story-shopping/story-types';
import { migrateStoryActiveStep, type StoryLiveActiveStep } from '../story-shopping/story-steps';

type V2Step = 'content' | 'product' | 'v2';

/**
 * 좌측 단계 목록. v2Index 는 ProjectWorkspace 단계(0 분석·1 수집·2 영상 선택·3 대본·4 내보내기).
 * 벤치마킹 영상을 고르면 바로 실제 분석 → 쿠팡 상품 확정 → 그 상품으로 5개 플랫폼에서 같은 상품 영상 찾기 → 제작.
 */
const NAV_STEPS: Array<{ key: string; step: V2Step; v2Index?: number; label: string; description: string; group: string }> = [
  { key: 'content', step: 'content', label: '콘텐츠 발굴', description: '벤치마킹 영상 고르기', group: '기획' },
  { key: 'v2-0', step: 'v2', v2Index: 0, label: 'AI 영상 분석', description: '영상 속 제품·구조 분석', group: '기획' },
  { key: 'product', step: 'product', label: 'AI 상품 서칭', description: '쿠팡 상품·가격·링크', group: '기획' },
  { key: 'v2-1', step: 'v2', v2Index: 1, label: '같은 상품 영상 찾기', description: '유튜브·인스타·틱톡·더우인·샤오홍슈', group: '영상 제작' },
  { key: 'v2-2', step: 'v2', v2Index: 2, label: V2_STEPS[2], description: '사용할 영상 고르기', group: '영상 제작' },
  { key: 'v2-3', step: 'v2', v2Index: 3, label: 'AI 대본·음성', description: '썰 대본·나레이션', group: '영상 제작' },
  { key: 'v2-5', step: 'v2', v2Index: 5, label: '영상 템플릿', description: '자막·화면 디자인 고르기', group: '영상 제작' },
  { key: 'v2-4', step: 'v2', v2Index: 4, label: 'AI 자동편집', description: '장면·자막·효과음 다듬고 영상 만들기', group: '영상 제작' },
];

function cloneBrief(): StoryShoppingBrief {
  return { ...EMPTY_STORY_BRIEF };
}

export default function StoryShoppingV2Page() {
  const [userId, setUserId] = useState('');
  const [projects, setProjects] = useState<ShoppingProject[]>([]);
  const [current, setCurrent] = useState<ShoppingProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // 해외판을 이 화면 안에서 볼 때 그 프로젝트 id (null = 한국어 원본)
  const [viewProjectId, setViewProjectId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [bridging, setBridging] = useState(false);
  const [activeStep, setActiveStep] = useState<V2Step>('content');
  const [v2Step, setV2Step] = useState(1);
  const [v2Available, setV2Available] = useState<boolean[] | null>(null);
  const [brief, setBrief] = useState<StoryShoppingBrief>(cloneBrief);
  // 다른 프로젝트를 열면 한국어 원본부터 보여 준다
  useEffect(() => setViewProjectId(null), [brief.v2SsulProjectId]);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // credentials 포함 + 캐시 금지 (쿠키 세션을 확실히 읽음)
        const response = await fetch(`/api/kakao/user?_=${Date.now()}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = (await response.json()) as {
          loggedIn?: boolean;
          user?: { id?: string | number; email?: string };
          error?: string;
        };
        if (cancelled) return;
        if (!data.loggedIn || !data.user || (data.user.id == null && !data.user.email)) {
          setError('썰쇼핑숏폼을 사용하려면 카카오 로그인이 필요합니다.');
          setLoading(false);
          return;
        }
        const uid = String(data.user.email || '').trim() || `kakao_${data.user.id}`;
        setUserId(uid);
        try {
          const list = await getShoppingProjects(uid, { pipelineVersion: 2 });
          if (!cancelled) {
            setProjects(list);
            setError('');
          }
        } catch (projectErr) {
          // 로그인 쿠키는 있는데 서버 검증이 실패한 경우 — 재로그인 유도
          if (!cancelled) {
            setError(
              projectErr instanceof Error
                ? projectErr.message
                : '프로젝트 목록을 불러오지 못했습니다. 다시 로그인해 주세요.',
            );
          }
        }
      } catch {
        if (!cancelled) setError('로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async (project: ShoppingProject, nextBrief: StoryShoppingBrief, step: V2Step) => {
      const updated = await updateShoppingProject(project.id, {
        data: {
          ...project.data,
          pipelineVersion: 2,
          appVariant: 'story',
          storyBrief: nextBrief,
          activeStep: step as StoryLiveActiveStep,
        },
      });
      setCurrent(updated);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      return updated;
    },
    [],
  );

  const openProject = async (project: ShoppingProject) => {
    const b = project.data.storyBrief ? { ...EMPTY_STORY_BRIEF, ...project.data.storyBrief } : cloneBrief();
    setBrief(b);
    const step = migrateStoryActiveStep(project.data.activeStep);
    const isBridged = b.v2Bridged ?? Boolean(b.v2SsulProjectId);
    const mapped: V2Step =
      step === 'product' && !isBridged ? 'product' : b.v2SsulProjectId ? 'v2' : step === 'product' ? 'product' : 'content';
    setActiveStep(mapped);
    // 분석만 된 프로젝트는 분석 화면, 상품까지 연결된 프로젝트는 수집 화면부터
    setV2Step(isBridged ? 1 : 0);
    setCurrent(project);
    setError('');
  };

  const createProject = async () => {
    if (!userId || !name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const project = await createShoppingProject(userId, name.trim(), description.trim() || undefined, {
        pipelineVersion: 2,
        appVariant: 'story',
        storyBrief: cloneBrief(),
        activeStep: 'content',
      });
      setProjects((prev) => [project, ...prev]);
      setShowCreate(false);
      setName('');
      setDescription('');
      await openProject(project);
    } catch (e) {
      setError(e instanceof Error ? e.message : '프로젝트 생성 실패');
    } finally {
      setCreating(false);
    }
  };

  const removeProject = async (id: string) => {
    if (!confirm('이 프로젝트를 삭제할까요?')) return;
    await deleteShoppingProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (current?.id === id) {
      setCurrent(null);
      setBrief(cloneBrief());
      setActiveStep('content');
    }
  };

  const selectWinningContent = async (video: StoryWinningContent) => {
    if (!current) return;
    const channelReference = {
      id: video.videoId,
      title: video.title,
      description: video.description,
      channelTitle: video.channelTitle,
      publishedAt: video.publishedAt,
      thumbnailUrl: video.thumbnailUrl,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      duration: '',
      durationSec: video.durationSeconds || 0,
      url: `https://www.youtube.com/watch?v=${video.videoId}`,
      embedUrl: `https://www.youtube.com/embed/${video.videoId}`,
      region: 'channel' as const,
    };
    let next: StoryShoppingBrief = {
      ...brief,
      winningContent: video,
      referenceVideos: [
        channelReference,
        ...brief.referenceVideos.filter((v) => v.id !== video.videoId),
      ].slice(0, 5),
      selectedProductVideoId: undefined,
      selectedProductSource: undefined,
    };
    // 같은 영상을 다시 고른 게 아니면 새 작업실을 만들고 실제 영상 분석을 바로 시작한다
    if (!brief.v2SsulProjectId || brief.winningContent?.videoId !== video.videoId) {
      setError('');
      try {
        const res = await fetch('/api/wings-shopping-v2/projects', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: channelReference.url, mode: 'ssul' }),
        });
        const created = (await res.json().catch(() => null)) as (Project & { error?: string }) | null;
        if (!res.ok || !created?.id) throw new Error(created?.error || '영상 분석을 시작하지 못했습니다.');
        next = { ...next, v2SsulProjectId: created.id, v2Bridged: false, v2OutputReady: false };
      } catch (e) {
        setError(e instanceof Error ? e.message : '영상 분석을 시작하지 못했습니다.');
        setBrief(next);
        await persist(current, next, 'product');
        setActiveStep('product');
        return;
      }
    }
    setBrief(next);
    await persist(current, next, 'v2');
    setV2Step(0);
    setActiveStep('v2');
  };

  const analyzeByUrl = async () => {
    const url = urlDraft.trim();
    if (!url || !current) return;
    setUrlBusy(true);
    setError('');
    try {
      const apiKey =
        typeof window !== 'undefined'
          ? (localStorage.getItem('shotform_openai_api_key') || '').trim()
          : '';
      const res = await fetch('/api/shotform/story-shopping/analyze-product', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: brief.winningContent?.title || `상품 URL · ${url}`,
          description: [
            brief.winningContent?.description || '',
            `사용자가 직접 입력한 상품/페이지 URL: ${url}`,
            '쿠팡에 동일 상품이 없어 URL 근거로 상품명을 추정한다.',
          ]
            .filter(Boolean)
            .join('\n'),
          thumbnailUrl: brief.winningContent?.thumbnailUrl,
          apiKey: apiKey || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        analysis?: {
          productName?: string;
          searchKeyword?: string;
          productDescription?: string;
          confidence?: number;
          evidence?: string[];
          analysisSummary?: string;
          hasTranscript?: boolean;
        };
      };
      if (!res.ok || !data.success || !data.analysis?.productName) {
        throw new Error(data.error || 'URL 분석에 실패했습니다.');
      }
      const a = data.analysis;
      const next: StoryShoppingBrief = {
        ...brief,
        productName: a.productName!,
        productDescription: a.productDescription || brief.productDescription,
        productUrl: /^https?:\/\//i.test(url) ? url : brief.productUrl,
        selectedProductVideoId: brief.winningContent?.videoId,
        selectedProductSource: 'manual',
        trendSource: `URL 직접 분석 · ${url.slice(0, 60)}`,
        productAnalysis: {
          videoId: brief.winningContent?.videoId || 'url-manual',
          source: 'ai-analysis',
          productName: a.productName!,
          searchKeyword: a.searchKeyword || a.productName!,
          productDescription: a.productDescription || '',
          confidence: a.confidence ?? 0,
          evidence: a.evidence ?? [`입력 URL: ${url}`],
          analysisSummary: a.analysisSummary || '',
          hasTranscript: Boolean(a.hasTranscript),
        },
      };
      setBrief(next);
      await persist(current, next, 'product');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'URL 분석 실패');
    } finally {
      setUrlBusy(false);
    }
  };

  const startV2Pipeline = async () => {
    if (!current || !brief.productName.trim()) return;
    setBridging(true);
    setError('');
    try {
      const winningUrl = brief.winningContent?.videoId
        ? `https://www.youtube.com/watch?v=${brief.winningContent.videoId}`
        : brief.referenceVideos?.[0]?.url || '';
      const res = await fetch('/api/wings-shopping-v2/story-bridge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          existingProjectId: brief.v2SsulProjectId,
          projectName: current.name,
          regenerateQueries: true,
          brief: {
            productName: brief.productName,
            productDescription: brief.productDescription,
            productUrl: brief.productUrl,
            priceBenefit: brief.priceBenefit,
            targetAudience: brief.targetAudience,
            problem: brief.problem,
            proof: brief.proof,
            winningContent: {
              videoId: brief.winningContent?.videoId,
              title: brief.winningContent?.title,
              channelTitle: brief.winningContent?.channelTitle,
              url: winningUrl,
            },
            productAnalysis: brief.productAnalysis,
            collectorData: brief.collectorData,
            referenceVideos: brief.referenceVideos,
          },
        }),
      });
      const project = (await res.json().catch(() => null)) as Project | null;
      if (!res.ok || !project?.id) {
        throw new Error((project as { error?: string } | null)?.error || '제작 파이프라인 연결에 실패했습니다.');
      }
      const next: StoryShoppingBrief = {
        ...brief,
        v2SsulProjectId: project.id,
        v2Bridged: true,
        v2OutputReady: false,
      };
      setBrief(next);
      await persist(current, next, 'v2');
      // 확정한 쿠팡 상품명으로 만든 검색어로 5개 플랫폼 검색을 바로 시작
      if (!project.searchResults?.length && project.jobs?.search?.state !== 'running') {
        void startStage(project.id, 'search').catch(() => undefined);
      }
      setV2Step(1);
      setActiveStep('v2');
    } catch (e) {
      setError(e instanceof Error ? e.message : '제작 연결 실패');
    } finally {
      setBridging(false);
    }
  };

  useEffect(() => {
    setV2Available(null);
  }, [brief.v2SsulProjectId]);

  // 예전 프로젝트는 상품 서칭이 끝난 뒤에만 v2 프로젝트가 생겼으므로 플래그가 없으면 연결된 것으로 본다
  const bridged = brief.v2Bridged ?? Boolean(brief.v2SsulProjectId);
  const activeNavKey = activeStep === 'v2' ? `v2-${v2Step}` : activeStep;
  const editorFull = activeStep === 'v2' && v2Step === 4;
  const activeNavIndex = NAV_STEPS.findIndex((n) => n.key === activeNavKey);
  // 작업실이 아직 안 열렸으면 단계별 열림 여부를 모름 → 분석·수집(진입점)만 연다
  const navEnabled = (n: (typeof NAV_STEPS)[number]) => {
    if (n.v2Index === undefined) return true;
    if (!brief.v2SsulProjectId) return false;
    if (n.v2Index >= 2 && !bridged) return false;
    return v2Available ? !!v2Available[n.v2Index] : n.v2Index <= 1;
  };
  // 수집 단계에서 "다음"을 누르면 쿠팡 상품 확정(상품 서칭)이 먼저
  // 열려고 한 단계가 아직 잠겨 있으면(예: 영상을 안 담은 예전 프로젝트) 열 수 있는 마지막 단계로
  useEffect(() => {
    if (activeStep !== 'v2' || !v2Available || v2Available[v2Step]) return;
    const fallback = [4, 3, 2, 1, 0].find((i) => v2Available[i] && (i === 0 || bridged));
    if (fallback !== undefined) setV2Step(fallback);
  }, [activeStep, v2Available, v2Step, bridged]);

  const changeV2Step = (s: number) => {
    // 분석 다음은 상품 서칭. 쿠팡 상품을 확정해야 영상 찾기부터 열린다
    if (s >= 1 && !bridged) {
      setActiveStep('product');
      return;
    }
    setV2Step(s);
  };
  const canGoV2 =
    Boolean(brief.productName.trim()) &&
    brief.selectedProductVideoId === brief.winningContent?.videoId;

  /* —— 랜딩: 버전1 밝은 블루 UI와 동일 톤 (hex로 강제) —— */
  if (!current) {
    return (
      <main className="light-keep relative min-h-screen overflow-hidden px-4 py-8 md:px-8" style={{ background: '#f7f8fb', color: '#0f172a' }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full blur-[110px]" style={{ background: 'rgba(59,130,246,0.10)' }} />
          <div className="absolute -right-32 top-40 h-[420px] w-[420px] rounded-full blur-[120px]" style={{ background: 'rgba(56,189,248,0.10)' }} />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between">
            <Link href="/WingsAIStudioShotForm">
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-xl border px-3 text-sm font-medium"
                style={{ borderColor: '#e2e8f0', background: '#ffffff', color: '#475569' }}
              >
                <Home className="mr-2 h-4 w-4" />
                메인화면
              </button>
            </Link>
            <span className="text-[10px] font-black tracking-[0.18em]" style={{ color: '#3b82f6' }}>
              AI SSUL SHOPPING
            </span>
          </div>

          <section
            className="mb-10 overflow-hidden rounded-[28px]"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 24px 60px -36px rgba(37,99,235,0.28)',
              color: '#0f172a',
            }}
          >
            <div className="grid min-h-[300px] lg:grid-cols-[1fr_300px]">
              <div className="flex flex-col justify-between p-7 md:p-10">
                <div>
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black tracking-[0.12em]"
                    style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb' }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: '#3b82f6' }} />
                    AI 썰쇼핑숏폼
                  </div>
                  <h1
                    className="mt-6 max-w-2xl text-4xl font-black leading-[1.08] tracking-[-0.04em] md:text-5xl"
                    style={{ color: '#0f172a' }}
                  >
                    사연이 끝나는 순간,
                    <br />
                    <span style={{ color: '#2563eb' }}>구매가 시작됩니다.</span>
                  </h1>
                  <p className="mt-5 max-w-xl text-sm leading-7" style={{ color: '#64748b' }}>
                    문제·반전·증거를 하나의 이야기로 설계하고 상품을 해결의 순간에 자연스럽게 연결하는
                    AI 스토리 커머스 스튜디오입니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  disabled={!userId}
                  className="mt-7 inline-flex h-12 w-fit items-center rounded-xl px-6 text-[15px] font-black text-white disabled:opacity-50"
                  style={{ background: '#2563eb', boxShadow: '0 12px 28px -12px rgba(37,99,235,0.65)' }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  AI 썰쇼핑숏폼 만들기
                </button>
              </div>
              <div
                className="relative hidden items-center justify-center overflow-hidden lg:flex"
                style={{ borderLeft: '1px solid #f1f5f9', background: 'linear-gradient(160deg,#eff6ff,#f8fafc)' }}
              >
                <div
                  className="relative h-[270px] w-[152px] overflow-hidden rounded-[24px] shadow-2xl"
                  style={{ border: '3px solid #1e293b', background: '#0f172a' }}
                >
                  <div className="absolute left-1/2 top-1.5 h-3 w-12 -translate-x-1/2 rounded-full" style={{ background: '#000' }} />
                  <div
                    className="absolute inset-x-2 top-7 z-10 rounded-md px-2 py-2 text-center text-[9px] font-black text-white"
                    style={{ background: '#3b82f6' }}
                  >
                    결국 이걸 샀습니다
                  </div>
                  <div className="absolute inset-x-2 bottom-12 top-[58px] overflow-hidden rounded-lg" style={{ background: '#0f172a' }}>
                    <video
                      className="h-full w-full object-cover"
                      src="/story-shopping-v2/sample-ssul.mp4"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      aria-label="썰쇼핑숏폼 샘플 영상"
                    />
                  </div>
                  <div
                    className="absolute inset-x-2 bottom-4 z-10 rounded-md px-2 py-2 text-center text-[8px] font-bold"
                    style={{ background: 'rgba(241,245,249,0.95)', color: '#475569' }}
                  >
                    STOP → STAY → SHOP
                  </div>
                  <div className="absolute bottom-1.5 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full" style={{ background: '#475569' }} />
                </div>
                {[
                  { label: 'STOP', copy: '3초 훅', top: '18%', left: '6%' },
                  { label: 'STAY', copy: '스토리', top: '46%', right: '6%' },
                  { label: 'SHOP', copy: '상품 발견', bottom: '16%', left: '8%' },
                ].map((tag) => (
                  <div
                    key={tag.label}
                    className="absolute rounded-xl px-2.5 py-1.5 shadow-md"
                    style={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid #e2e8f0',
                      top: tag.top,
                      left: tag.left,
                      right: (tag as { right?: string }).right,
                      bottom: (tag as { bottom?: string }).bottom,
                    }}
                  >
                    <p className="text-[9px] font-black tracking-wide" style={{ color: '#2563eb' }}>{tag.label}</p>
                    <p className="text-[10px] font-bold" style={{ color: '#334155' }}>{tag.copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black tracking-[0.2em]" style={{ color: '#3b82f6' }}>RECENT PROJECTS</p>
              <h2 className="mt-1 text-xl font-black" style={{ color: '#0f172a' }}>스토리 작업실</h2>
            </div>
            <p className="text-sm" style={{ color: '#64748b' }}>{projects.length}개의 프로젝트</p>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626' }}>
              <p>{error}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`/api/kakao/auth?redirect=${encodeURIComponent('/WingsAIStudioShotForm/story-shopping-v2')}`}
                  className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-bold text-white"
                  style={{ background: '#2563eb' }}
                >
                  카카오 로그인하고 돌아오기
                </a>
                <Link href="/WingsAIStudioShotForm" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-bold" style={{ borderColor: '#fecaca', color: '#b91c1c' }}>
                  ShotForm 메인
                </Link>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 py-16" style={{ color: '#64748b' }}>
              <Loader2 className="h-5 w-5 animate-spin" /> 불러오는 중…
            </div>
          ) : projects.length === 0 ? (
            <div
              className="rounded-2xl px-6 py-16 text-center"
              style={{ border: '1px dashed #e2e8f0', background: '#ffffff', color: '#64748b' }}
            >
              <p className="text-sm">첫 썰쇼핑숏폼을 시작해보세요.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p, i) => (
                <div
                  key={p.id}
                  className="group relative overflow-hidden rounded-2xl p-5 transition hover:shadow-lg"
                  style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
                >
                  <span className="pointer-events-none absolute -right-1 -top-2 text-6xl font-black" style={{ color: '#f1f5f9' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    className="absolute right-3 top-3 rounded-lg p-1.5"
                    style={{ color: '#94a3b8' }}
                    onClick={() => void removeProject(p.id)}
                    aria-label="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <h3 className="relative pr-8 text-base font-black" style={{ color: '#0f172a' }}>{p.name}</h3>
                  <p className="relative mt-1 text-xs" style={{ color: '#64748b' }}>{p.description || '새 AI 썰쇼핑숏폼 프로젝트'}</p>
                  <p className="relative mt-3 text-[11px]" style={{ color: '#94a3b8' }}>
                    {p.data.storyBrief?.v2SsulProjectId ? '제작 진행 중' : '기획 전'} ·{' '}
                    {new Date(p.updated_at).toLocaleDateString('ko-KR')}
                  </p>
                  <button
                    type="button"
                    className="relative mt-4 flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-bold text-white"
                    style={{ background: '#0f172a' }}
                    onClick={() => void openProject(p)}
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    프로젝트 열기
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="light-keep border-slate-200 bg-white text-slate-900">
            <DialogHeader>
              <DialogTitle>새 썰쇼핑숏폼 프로젝트</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="프로젝트 이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <textarea
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                rows={3}
                placeholder="어떤 스토리와 상품을 다룰지 간단히 적어주세요."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>취소</Button>
              <Button
                className="bg-blue-600 text-white hover:bg-blue-500"
                disabled={creating || !name.trim() || !userId}
                onClick={() => void createProject()}
              >
                {creating ? '만드는 중…' : '만들기'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    );
  }

  /* —— 작업 화면 —— */
  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-900">
      <header className="light-keep text-slate-900 sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="shrink-0 text-slate-600"
              onClick={() => {
                setCurrent(null);
                setActiveStep('content');
              }}
            >
              <Home className="mr-1 h-4 w-4" />
              메인
            </Button>
            <Button type="button" variant="ghost" className="shrink-0 text-slate-500" onClick={() => setActiveStep('content')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{current.name}</p>
              <p className="text-[10px] font-black tracking-[0.16em] text-blue-500">AI 썰쇼핑숏폼</p>
            </div>
          </div>
          <Button
            className="bg-blue-600 font-bold text-white hover:bg-blue-500"
            disabled={bridging || saveState === 'saving'}
            onClick={async () => {
              if (!current) return;
              setSaveState('saving');
              try {
                await persist(current, brief, activeStep);
                setSaveState('saved');
              } catch {
                setSaveState('error');
              }
              setTimeout(() => setSaveState('idle'), 2000);
            }}
          >
            <span aria-live="polite">
              {saveState === 'saving' ? '저장 중...' : saveState === 'saved' ? '✓ 저장했어요' : saveState === 'error' ? '저장 실패 · 다시 누르기' : '저장'}
            </span>
          </Button>
        </div>
      </header>

      {/* 자동편집 단계는 왼쪽 단계 목록 없이 전체 화면으로 쓴다 */}
      <div className={`mx-auto max-w-[1440px] px-4 py-6 md:px-6 ${editorFull ? '' : 'lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:items-start lg:gap-6'}`}>
        {editorFull && (
          <div className="light-keep mb-4 flex items-center justify-between gap-3 text-slate-900">
            <button
              type="button"
              onClick={() => setV2Step(5)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-600"
            >
              <ArrowLeft className="h-4 w-4" />
              영상 템플릿
            </button>
            <p className="text-xs font-semibold text-slate-500">8단계 · AI 자동편집</p>
          </div>
        )}
        <nav
          aria-label="진행 단계"
          hidden={editorFull}
          className="light-keep mb-6 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 lg:sticky lg:top-20 lg:mb-0"
        >
          <ol className="space-y-1">
            {NAV_STEPS.map((n, index) => {
              const active = n.key === activeNavKey;
              const complete = index < activeNavIndex;
              const enabled = navEnabled(n);
              const groupStart = index === 0 || NAV_STEPS[index - 1].group !== n.group;
              return (
                <li key={n.key}>
                  {groupStart ? (
                    <p className={`px-2 pb-1 text-[10px] font-black tracking-[0.16em] text-slate-400 ${index === 0 ? 'pt-1' : 'pt-4'}`}>
                      {n.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={!enabled}
                    aria-current={active ? 'step' : undefined}
                    onClick={() => {
                      setActiveStep(n.step);
                      if (n.v2Index !== undefined) setV2Step(n.v2Index);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      active ? 'border-blue-300 bg-blue-50' : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                        active ? 'bg-blue-600 text-white' : complete ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{n.label}</span>
                      <span className="block truncate text-[11px] text-slate-500">{n.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0">
        {error ? (
          <div className="light-keep mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        ) : null}

        {activeStep === 'content' && userId ? (
          <StoryWinningContentPanel userId={userId} selected={brief.winningContent} onSelect={(v) => void selectWinningContent(v)} />
        ) : null}

        {activeStep === 'product' ? (
          <div className="space-y-4">
            <StoryProductSearchPanel brief={brief} onChange={setBrief} />

            <div className="light-keep rounded-2xl border border-slate-200 bg-white p-5 text-slate-900">
              <h3 className="text-base font-black text-slate-900">상품이 없을 때 · URL로 분석</h3>
              <p className="mt-1 text-sm text-slate-500">
                쿠팡에 없거나 태그를 못 찾은 경우, 상품·영상 URL을 넣으면 분석해 스토리를 이어갑니다.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  placeholder="https://… (상품 페이지 또는 영상 URL)"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                />
                <Button
                  className="bg-slate-900 font-bold text-white hover:bg-blue-600"
                  disabled={urlBusy || !urlDraft.trim()}
                  onClick={() => void analyzeByUrl()}
                >
                  {urlBusy ? '분석 중…' : 'URL 분석'}
                </Button>
              </div>
            </div>

            <div className="light-keep flex gap-3 text-slate-900">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (!brief.v2SsulProjectId) return setActiveStep('content');
                  setV2Step(0);
                  setActiveStep('v2');
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {brief.v2SsulProjectId ? '영상 분석으로' : '콘텐츠 다시 선택'}
              </Button>
              <Button
                className="flex-1 bg-blue-600 font-black text-white hover:bg-blue-500"
                disabled={!canGoV2 || bridging}
                onClick={() => void startV2Pipeline()}
              >
                {bridging
                  ? '제작 화면 연결 중…'
                  : brief.selectedProductSource === 'manual'
                    ? 'URL·직접 진행으로 제작 시작'
                    : '선택 상품으로 제작 시작'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {/* 바깥 박스 없이 각 단계의 카드만 보이게 (wings-shopping-v2 의 베이지 배경도 끔) */}
        {activeStep === 'v2' && brief.v2SsulProjectId ? (
          <div className="light-keep wings-shopping-v2" style={{ background: 'transparent' }}>
            <ProjectWorkspace
              projectId={viewProjectId ?? brief.v2SsulProjectId}
              onOpenVersion={(id) => setViewProjectId(id === brief.v2SsulProjectId ? null : id)}
              embedded
              step={v2Step}
              onStepChange={changeV2Step}
              separateTemplateStep
              hideFlowPanel
              exportEditor
              analyzeNextLabel={bridged ? '같은 상품 영상 찾기' : '상품 서칭으로'}
              onAvailableChange={setV2Available}
              thumbnailSlot={
                current ? (
                  <V2ThumbnailTab
                    brief={brief}
                    onChange={(next) => {
                      setBrief(next);
                      void persist(current, next, 'v2');
                    }}
                    projectId={current.id}
                  />
                ) : undefined
              }
            />
          </div>
        ) : null}
        </div>
      </div>
    </main>
  );
}
