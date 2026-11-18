'use client';
import { mediaUrl, patchProject, startStage, useBufferedVideoUrl } from '@/lib/wings-shopping-v2/client';
import { shotformVmakeApiKey, shotformVmakeSecretAccessKey } from '@/lib/shotform-vmake-subtitle-removal';
import PublishPanel from './PublishPanel';
import PlatformCopyPanel from './PlatformCopyPanel';
import { JobLine, Panel } from './ui';
import type { StepProps } from './types';

/** 업로드 탭 (렌더링 · 플랫폼별 설명·태그·댓글) */
export default function UploadTab({ project, setProject, refresh }: Pick<StepProps, 'project' | 'setProject' | 'refresh'>) {
  const job = project.jobs.render;
  const running = job?.state === 'running';
  const out = project.output;
  const missing = (project.script?.beats ?? []).findIndex((b) => !b.clipId || !b.tts);
  const rawVideoUrl = out && !running ? `${mediaUrl(project.id, out.file)}?v=${out.at ?? 0}` : null;
  const playableUrl = useBufferedVideoUrl(rawVideoUrl);

  const render = async () => {
    // Vmake 자막 제거를 고른 경우 설정에 저장된 Vmake 키를 같이 보낸다 (ExportStep과 동일)
    const vmakeApiKey = shotformVmakeApiKey();
    const vmakeSecretAccessKey = shotformVmakeSecretAccessKey();
    await startStage(project.id, 'render', vmakeApiKey && vmakeSecretAccessKey ? { vmakeApiKey, vmakeSecretAccessKey } : undefined).catch(() => undefined);
    refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-text">영상에 [광고] 표기</p>
          <p className="text-xs text-muted">첫 3초 아래 배너 + 영상 내내 오른쪽 위 [광고] 표시. 제휴·협찬 영상이면 켜 두세요.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={project.publish?.onScreen !== false}
          onClick={async () => setProject(await patchProject(project.id, { publish: { onScreen: project.publish?.onScreen === false } }))}
          className={`rounded-full px-4 py-1.5 text-sm font-bold ${project.publish?.onScreen !== false ? 'bg-amber text-amber-ink' : 'border border-line text-muted'}`}
        >
          {project.publish?.onScreen !== false ? '넣기' : '빼기'}
        </button>
      </div>
      <Panel title="렌더링"
        actions={
          <>
            <button className="btn btn-primary" disabled={running || missing >= 0} onClick={render}>
              {running ? '만드는 중...' : out ? '다시 만들기' : '영상 만들기'}
            </button>
            {out && !running && <a className="btn btn-ghost" href={`${mediaUrl(project.id, out.file)}?download`}>mp4 내려받기</a>}
          </>
        }>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {out && !running && playableUrl && (
            <video key={out.at} src={playableUrl} controls preload="auto" playsInline
              className="mx-auto aspect-[9/16] w-full max-w-[200px] shrink-0 rounded-xl bg-black sm:mx-0" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {missing >= 0 && <p className="text-sm text-danger">{missing + 1}번 문장에 장면이나 음성이 없습니다. 대본·음성 단계에서 채워 주세요.</p>}
            <JobLine job={job} idleText={out ? undefined : '1080×1920 영상으로 장면을 잇고, 음성과 자막을 입힙니다.'} />
            {out && !running && (
              <p className={`text-sm ${out.stale ? 'text-amber' : 'text-muted'}`}>
                {out.stale ? '편집 내용이 바뀌었습니다. 다시 만들기를 눌러 반영하세요.' : `완성본 준비됨${out.at ? ` · ${new Date(out.at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}`}
              </p>
            )}
            {out?.notes?.map((n) => <p key={n} className="text-sm text-amber">{n}</p>)}
          </div>
        </div>
      </Panel>
      <PlatformCopyPanel project={project} setProject={setProject} />
      <PublishPanel project={project} setProject={setProject} />
    </div>
  );
}
