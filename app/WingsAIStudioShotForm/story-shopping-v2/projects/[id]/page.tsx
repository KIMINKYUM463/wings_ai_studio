'use client';
import ProjectWorkspace from '@/components/wings-shopping-v2/ProjectWorkspace';

export default function StoryShoppingV2ProjectPage({ params }: { params: { id: string } }) {
  return <ProjectWorkspace projectId={params.id} />;
}
