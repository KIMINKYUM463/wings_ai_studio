'use client';
import { mediaUrl, startStage, useBufferedVideoUrl } from '@/lib/wings-shopping-v2/client';
import { JobLine, Panel } from './ui';
import ThumbnailPanel from './ThumbnailPanel';
import FxPanel from './FxPanel';
import AutoEditLauncher from './AutoEditLauncher';
import PublishPanel from './PublishPanel';
import LocalizePanel from './LocalizePanel';
import type { StepProps } from './types';
import { shotformVmakeApiKey, shotformVmakeSecretAccessKey } from '@/lib/shotform-vmake-subtitle-removal';

export default function ExportStep(props: StepProps & { editor?: boolean }) {
  if (props.editor) return <AutoEditLauncher {...props} />;
  return <LegacyExport {...props} />;
}

function LegacyExport({ project, setProject, refresh, onOpenVersion }: StepProps) {
  const job = project.jobs.render;
  const running = job?.state === 'running';
  const out = project.output;
  const missing = (project.script?.beats ?? []).findIndex((b) => !b.clipId || !b.tts);
  const rawVideoUrl = out && !running ? `${mediaUrl(project.id, out.file)}?v=${out.at ?? 0}` : null;
  const playableUrl = useBufferedVideoUrl(rawVideoUrl);

  return (
    <div className="flex flex-col gap-6">
      <FxPanel project={project} setProject={setProject} />
      <Panel
        title="내보내기"
        actions={
          <>
            <button className="btn btn-primary" disabled={running || missing >= 0} onClick={async () => {
              // Vmake 자막 제거를 고른 경우 설정에 저장된 Vmake 키를 같이 보낸다
              const vmakeApiKey = shotformVmakeApiKey();
              const vmakeSecretAccessKey = shotformVmakeSecretAccessKey();
              await startStage(project.id, 'render', vmakeApiKey && vmakeSecretAccessKey ? { vmakeApiKey, vmakeSecretAccessKey } : undefined).catch(() => undefined);
              refresh();
            }}>
              {out ? '다시 만들기' : '영상 만들기'}
            </button>
            {out && !running && (
              <a className="btn btn-ghost" href={`${mediaUrl(project.id, out.file)}?download`}>mp4 내려받기</a>
            )}
          </>
        }
      >
        {missing >= 0 && <p className="text-sm text-danger">{missing + 1}번 문장에 장면이나 음성이 없습니다. 대본·음성 단계에서 채워 주세요.</p>}
        <JobLine job={job} idleText={out ? undefined : '1080×1920 영상으로 장면을 잇고, 음성과 자막을 입힙니다.'} />
        {out?.notes?.map((n) => <p key={n} className="mt-2 text-sm text-amber">{n}</p>)}
        {out?.stale && !running && <p className="mt-2 text-sm text-amber">앞 단계가 바뀌었습니다. 다시 만들기를 눌러 반영하세요.</p>}
        {out && !running && playableUrl && (
          <video key={out.at} src={playableUrl}
            controls preload="auto" playsInline className="mx-auto mt-5 aspect-[9/16] w-full max-w-[360px] rounded-2xl bg-black" />
        )}
      </Panel>
      {project.script?.beats.length ? <ThumbnailPanel project={project} setProject={setProject} /> : null}
      {project.script?.beats.length ? <PublishPanel project={project} setProject={setProject} /> : null}
      {project.script?.beats.length ? <LocalizePanel project={project} onOpen={onOpenVersion} /> : null}
    </div>
  );
}
