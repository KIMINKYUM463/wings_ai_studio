import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type { JobStatus, Project, Stage, StoryMode } from './types';
import { isStoryMode } from './types';
import { modeDefaults } from './ssul/settings';
import { currentOwnerId, MULTI_USER } from './request-ctx';

export function dataDir(): string {
  return process.env.WINGS_SHOPPING_V2_DATA_DIR || path.join(process.cwd(), 'data', 'wings-shopping-v2');
}

export function projectDir(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('잘못된 프로젝트 id');
  return path.join(dataDir(), 'projects', id);
}

const projectFile = (id: string) => path.join(projectDir(id), 'project.json');

// 프로젝트별 쓰기 직렬화 (프로세스 내). 개발 서버 핫리로드 후에도 같은 맵을 쓰도록 globalThis에 둔다.
const g = globalThis as unknown as { __wingsShoppingV2StoreLocks?: Map<string, Promise<unknown>> };
const locks = (g.__wingsShoppingV2StoreLocks ??= new Map<string, Promise<unknown>>());

async function writeAtomic(file: string, data: string) {
  const tmp = `${file}.${nanoid(6)}.tmp`;
  await fs.writeFile(tmp, data, 'utf8');
  for (let i = 0; ; i++) {
    try {
      await fs.rename(tmp, file);
      return;
    } catch (e) {
      // Windows: 다른 핸들이 파일을 읽는 중이면 EPERM이 날 수 있다
      if (i >= 5) throw e;
      await new Promise((r) => setTimeout(r, 20 * (i + 1)));
    }
  }
}

export async function createProject(url: string, mode: 'remix' | StoryMode = 'remix'): Promise<Project> {
  const id = nanoid(10).replace(/[^A-Za-z0-9_-]/g, '_');
  const p: Project = {
    id,
    name: '새 프로젝트',
    createdAt: new Date().toISOString(),
    referenceUrl: url,
    selected: [],
    sources: [],
    clips: [],
    voice: { voiceId: '', speed: 1.1 },
    jobs: {},
    mode,
  };
  const owner = await currentOwnerId();
  if (owner) p.ownerId = owner;
  if (isStoryMode(mode)) {
    const { voice, ...ssul } = modeDefaults(mode);
    p.ssul = ssul;
    p.voice = voice;
    if (mode === 'travel') p.travelInfo = { productType: '' };
    if (mode === 'review') p.reviewInfo = { items: '' };
  }
  await fs.mkdir(projectDir(id), { recursive: true });
  await writeAtomic(projectFile(id), JSON.stringify(p, null, 2));
  return p;
}

/** 새 id로 프로젝트 저장 (복제·해외판용). 폴더가 이미 있어야 하면 먼저 만든다 */
export async function saveNewProject(p: Project): Promise<Project> {
  const owner = await currentOwnerId();
  if (owner) p.ownerId = owner;
  await fs.mkdir(projectDir(p.id), { recursive: true });
  await writeAtomic(projectFile(p.id), JSON.stringify(p, null, 2));
  return p;
}

export const newProjectId = () => nanoid(10).replace(/[^A-Za-z0-9_-]/g, '_');

async function readProject(id: string): Promise<Project> {
  const raw = await fs.readFile(projectFile(id), 'utf8');
  return JSON.parse(raw) as Project;
}

/** 공용 모드에서는 본인 프로젝트만 열 수 있다 */
export async function getProject(id: string): Promise<Project> {
  const p = await readProject(id);
  if (MULTI_USER) {
    const owner = await currentOwnerId();
    if (!p.ownerId || p.ownerId !== owner) throw new Error('프로젝트를 찾을 수 없습니다.');
  }
  return p;
}

export async function listProjects(): Promise<Project[]> {
  const root = path.join(dataDir(), 'projects');
  let ids: string[] = [];
  try {
    ids = await fs.readdir(root);
  } catch {
    return [];
  }
  const owner = await currentOwnerId();
  const out: Project[] = [];
  for (const id of ids) {
    try {
      const p = await readProject(id);
      if (MULTI_USER && p.ownerId !== owner) continue;
      out.push(p);
    } catch {
      /* 손상된 폴더는 건너뜀 */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateProject(id: string, fn: (p: Project) => void | Promise<void>): Promise<Project> {
  const prev = locks.get(id) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(async () => {
    const p = await getProject(id);
    await fn(p);
    await writeAtomic(projectFile(id), JSON.stringify(p, null, 2));
    return p;
  });
  locks.set(id, next);
  return next;
}

export function setJob(id: string, stage: Stage, status: Omit<JobStatus, 'stage'>): Promise<Project> {
  return updateProject(id, (p) => {
    p.jobs[stage] = { stage, ...status };
  });
}
