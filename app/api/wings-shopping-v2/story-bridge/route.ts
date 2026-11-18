import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateJson } from '@/lib/wings-shopping-v2/ai/gemini';
import { geminiApiKey } from '@/lib/wings-shopping-v2/gemini-key';
import { modeDefaults } from '@/lib/wings-shopping-v2/ssul/settings';
import { createProject, getProject, updateProject } from '@/lib/wings-shopping-v2/store';
import type { Analysis, Project } from '@/lib/wings-shopping-v2/types';
import { sameVideo } from '@/lib/wings-shopping-v2/search/search';

export const runtime = 'nodejs';

const SearchQueriesOnlySchema = z.object({
  category: z.string().default('생활·쇼핑 꿀템'),
  searchQueries: z.object({
    youtube: z.array(z.string()).default([]),
    tiktok: z.array(z.string()).default([]),
    instagram: z.array(z.string()).default([]),
    douyin: z.array(z.string()).default([]),
    xiaohongshu: z.array(z.string()).default([]),
  }),
});

interface IncomingStoryBrief {
  productName?: string;
  productDescription?: string;
  productUrl?: string;
  priceBenefit?: string;
  targetAudience?: string;
  problem?: string;
  proof?: string;
  winningContent?: {
    videoId?: string;
    title?: string;
    channelTitle?: string;
    url?: string;
  };
  productAnalysis?: {
    productQuery?: string;
    productCategory?: string;
    reason?: string;
  };
  collectorData?: {
    collectedProductName?: string;
    reviews?: Array<{ rating?: number; content?: string }>;
    detailInsights?: {
      oneLineSummary?: string;
      coreBenefits?: string[];
      specifications?: string[];
    };
    reviewInsights?: {
      pros?: string[];
      cons?: string[];
      vividQuotes?: string[];
    };
  };
  referenceVideos?: Array<{ url?: string }>;
}

function compactProductCore(rawName: string, queryHint?: string): string {
  const hint = (queryHint || '').trim();
  if (hint && hint.length <= 28) return hint;
  const cleaned = rawName
    .replace(/\[[^\]]*\]|\([^)]*\)|【[^】]*】/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:ml|g|kg|개입|매입|세트|팩|개|매|p|ea|호|단)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.split(' ').slice(0, 5).join(' ') || rawName.trim() || '인기 꿀템';
}

function fallbackSearchQueries(core: string): Analysis['searchQueries'] {
  const q = core.trim() || '생활 꿀템';
  return {
    youtube: [`${q} 리뷰`, `${q} 사용법`, `${q} 추천 쇼츠`],
    tiktok: [`${q} 추천`, `${q} 후기`, q],
    instagram: [`${q} 추천`, `${q} 꿀템`],
    douyin: [q, `${q} 测评`, `${q} 好物`],
    xiaohongshu: [q, `${q} 测评`, `${q} 推荐`],
  };
}

async function buildSearchQueries(
  productName: string,
  core: string,
  description: string,
  categoryHint?: string,
): Promise<{ category: string; searchQueries: Analysis['searchQueries'] }> {
  if (!geminiApiKey()) {
    return {
      category: categoryHint || '생활·쇼핑 꿀템',
      searchQueries: fallbackSearchQueries(core),
    };
  }
  try {
    const res = await generateJson<z.output<typeof SearchQueriesOnlySchema>>(
      SearchQueriesOnlySchema,
      [
        '아래 한국 쇼핑 상품과 동일한 실물 제품의 실제 사용·시연 숏폼 영상을 플랫폼별로 찾기 위한 검색어를 JSON으로 만들어라.',
        `상품 전체명: ${productName}`,
        `핵심 검색어 힌트: ${core}`,
        `상품 설명: ${description.slice(0, 400)}`,
        '',
        '규칙:',
        '- 브랜드명이 너무 마이너하면 일반 제품군 명칭 검색어도 반드시 함께 넣어라.',
        '- youtube: 한국어 짧은 검색어 3개 (예: "실리콘 냄비받침 사용", "접이식 냄비받침 후기")',
        '- tiktok: 한국어 + 영어 짧은 검색어 3개',
        '- instagram: 한국어 릴스용 짧은 검색어 2~3개',
        '- douyin: 중국 본토 더우인에서 실제 시연 영상이 잘 나오는 간체 중국어 검색어 3개 (예: "硅胶隔热垫", "折叠锅垫 测评")',
        '- xiaohongshu: 샤오홍슈에서 실사용 영상이 잘 나오는 간체 중국어 검색어 3개',
        '- JSON 형식: {"category":"카테고리명","searchQueries":{"youtube":[...],"tiktok":[...],"instagram":[...],"douyin":[...],"xiaohongshu":[...]}}',
      ].join('\n'),
      undefined,
      [],
      0.3,
    );
    const fb = fallbackSearchQueries(core);
    return {
      category: res.category || categoryHint || '생활·쇼핑 꿀템',
      searchQueries: {
        youtube: res.searchQueries.youtube.length ? res.searchQueries.youtube : fb.youtube,
        tiktok: res.searchQueries.tiktok.length ? res.searchQueries.tiktok : fb.tiktok,
        instagram: res.searchQueries.instagram.length ? res.searchQueries.instagram : fb.instagram,
        douyin: res.searchQueries.douyin.length ? res.searchQueries.douyin : fb.douyin,
        xiaohongshu: res.searchQueries.xiaohongshu.length ? res.searchQueries.xiaohongshu : fb.xiaohongshu,
      },
    };
  } catch {
    return {
      category: categoryHint || '생활·쇼핑 꿀템',
      searchQueries: fallbackSearchQueries(core),
    };
  }
}

function buildFactRichAnalysis(
  brief: IncomingStoryBrief,
  prevAnalysis: Analysis | undefined,
  category: string,
  searchQueries: Analysis['searchQueries'],
): Analysis {
  const productName =
    brief.productName?.trim() ||
    brief.collectorData?.collectedProductName?.trim() ||
    brief.productAnalysis?.productQuery?.trim() ||
    prevAnalysis?.productName ||
    '선택 상품';

  const descParts: string[] = [];
  if (brief.productDescription?.trim()) descParts.push(brief.productDescription.trim());
  if (brief.priceBenefit?.trim()) descParts.push(`가격/혜택: ${brief.priceBenefit.trim()}`);
  if (brief.productAnalysis?.reason?.trim()) descParts.push(`레퍼런스 영상 분석: ${brief.productAnalysis.reason.trim()}`);
  if (brief.collectorData?.detailInsights?.oneLineSummary) {
    descParts.push(`상세 핵심: ${brief.collectorData.detailInsights.oneLineSummary}`);
  }
  if (brief.collectorData?.detailInsights?.specifications?.length) {
    descParts.push(`스펙/특징: ${brief.collectorData.detailInsights.specifications.slice(0, 5).join(', ')}`);
  }
  const topReviews = (brief.collectorData?.reviews ?? [])
    .map((r) => (r.content || '').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length >= 12)
    .slice(0, 5);
  if (topReviews.length) {
    descParts.push(`실제 구매자 후기 요약: ${topReviews.map((t) => `"${t.slice(0, 90)}"`).join(' / ')}`);
  }

  const sellingPoints = Array.from(
    new Set(
      [
        ...(brief.collectorData?.detailInsights?.coreBenefits ?? []),
        ...(brief.collectorData?.reviewInsights?.pros ?? []),
        ...(brief.collectorData?.reviewInsights?.vividQuotes ?? []),
        brief.problem ? `해결 포인트: ${brief.problem}` : '',
        brief.proof ? `근거: ${brief.proof}` : '',
        brief.priceBenefit ? `가격 정보: ${brief.priceBenefit}` : '',
        ...(prevAnalysis?.keySellingPoints ?? []),
      ]
        .map((s) => String(s || '').trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);

  const brandOrModel =
    prevAnalysis?.brandOrModel || compactProductCore(productName, brief.productAnalysis?.productQuery);
  // 벤치마킹 영상을 실제로 분석한 결과(scenes 가 있음)가 있으면 그 구조를 그대로 살린다
  const realStructure = prevAnalysis?.scenes?.length ? prevAnalysis.structure : undefined;
  const hookStyle =
    realStructure?.hook ||
    (brief.winningContent?.title
      ? `터진 레퍼런스 참고 (${brief.winningContent.title.slice(0, 50)})`
      : prevAnalysis?.hookStyle || '공감/호기심 유발 썰 도입부');
  const narrativeArc =
    realStructure?.body || prevAnalysis?.narrativeArc || '후킹 → 일상 상황/갈등 → 상품 등장 → 반전/증거 → 행동 유도';
  const duration = prevAnalysis?.estimatedDurationSec || prevAnalysis?.duration || 32;

  return {
    productName,
    category,
    keywords: Array.from(new Set([brandOrModel, productName, ...(sellingPoints.slice(0, 3))].filter(Boolean))),
    searchQueries,
    structure: {
      hook: hookStyle,
      body: narrativeArc,
      cta: brief.proof?.trim() || realStructure?.cta || '프로필 링크에서 확인해보세요',
    },
    scenes: prevAnalysis?.scenes ?? [],
    narrationTone:
      (realStructure && prevAnalysis?.narrationTone) || brief.targetAudience?.trim() || prevAnalysis?.narrationTone || '공감·반전 썰 톤',
    duration,
    brandOrModel,
    keySellingPoints: sellingPoints.length ? sellingPoints : [`${productName} 실사용 편의성`, '일상 문제 해결 꿀템'],
    targetAudience: brief.targetAudience?.trim() || prevAnalysis?.targetAudience || '일상 속 불편함을 해결하고 싶은 소비자',
    hookStyle,
    narrativeArc,
    estimatedDurationSec: duration,
    productDescription: descParts.join('\n') || `${productName} 소개 및 실제 사용 포인트`,
  } as Analysis;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    existingProjectId?: string;
    projectName?: string;
    brief?: IncomingStoryBrief;
    regenerateQueries?: boolean;
  };
  const brief = body.brief ?? {};
  const winningUrl = brief.winningContent?.url?.trim() || '';
  const refUrls = Array.from(
    new Set(
      [
        winningUrl,
        ...(brief.referenceVideos ?? []).map((v) => String(v.url || '').trim()),
      ].filter((u) => /^https?:\/\//i.test(u)),
    ),
  );

  let project: Project | null = null;
  if (body.existingProjectId && /^[A-Za-z0-9_-]+$/.test(body.existingProjectId)) {
    project = await getProject(body.existingProjectId).catch(() => null);
  }
  if (!project) {
    project = await createProject(winningUrl || refUrls[0] || 'https://story-shopping.local/ssul', 'ssul');
  }

  const incomingProductName =
    brief.productName?.trim() ||
    brief.collectorData?.collectedProductName?.trim() ||
    brief.productAnalysis?.productQuery?.trim() ||
    '';

  const prevProductName = project.analysis?.productName?.trim() || '';
  const needFreshQueries =
    Boolean(body.regenerateQueries) ||
    !project.analysis?.searchQueries?.youtube?.length ||
    (Boolean(incomingProductName) && incomingProductName !== prevProductName);

  const core = compactProductCore(
    incomingProductName || prevProductName || body.projectName || '인기 꿀템',
    brief.productAnalysis?.productQuery,
  );
  const queryPack = needFreshQueries
    ? await buildSearchQueries(
        incomingProductName || prevProductName || core,
        core,
        brief.productDescription || '',
        brief.productAnalysis?.productCategory,
      )
    : {
        category: project.analysis?.category || brief.productAnalysis?.productCategory || '생활·쇼핑 꿀템',
        searchQueries: project.analysis!.searchQueries,
      };

  const nextAnalysis = buildFactRichAnalysis(
    brief,
    project.analysis,
    queryPack.category,
    queryPack.searchQueries,
  );

  const updated = await updateProject(project.id, (cur) => {
    cur.mode = 'ssul';
    if (!cur.ssul) {
      const { voice, ...ssul } = modeDefaults('ssul');
      cur.ssul = ssul;
      if (!cur.voice?.voiceId) cur.voice = voice;
    }
    cur.name = (incomingProductName || body.projectName || cur.name || '스토리 쇼핑 숏폼').slice(0, 80);
    if (winningUrl) cur.referenceUrl = winningUrl;
    cur.analysis = nextAnalysis;
    if (brief.productUrl?.trim()) {
      cur.publish = {
        affiliate: cur.publish?.affiliate && cur.publish.affiliate !== 'none' ? cur.publish.affiliate : 'coupang',
        link: brief.productUrl.trim(),
        bannerText: cur.publish?.bannerText,
        onScreen: cur.publish?.onScreen ?? true,
        pack: cur.publish?.pack,
      };
    }
    // 벤치마킹(레퍼런스) 영상은 분석에만 쓰고 편집 소스로는 쓰지 않는다
    const refs = [cur.referenceUrl, ...refUrls].filter(Boolean);
    cur.selected = cur.selected.filter((u) => !refs.some((r) => sameVideo(u, r)));
  });

  return NextResponse.json(updated);
}
