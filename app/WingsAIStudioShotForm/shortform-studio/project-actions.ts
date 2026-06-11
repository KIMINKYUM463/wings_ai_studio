"use server"

import { createMvpProjectsClient, formatSupabaseError } from "@/lib/supabase/mvp-projects"
import type { MvpTestProject, MvpTestProjectData } from "./project-types"

function wrapDbError(error: unknown, action: string): never {
  const detail = formatSupabaseError(error)
  console.error(`[MVP Projects] ${action} 실패:`, error)
  if (detail.includes("42501") || detail.toLowerCase().includes("permission")) {
    throw new Error(
      `Supabase 권한 오류: scripts/disable_mvp_test_projects_rls.sql 을 SQL Editor에서 실행해 주세요. (${detail})`
    )
  }
  if (detail.includes("PGRST205") || detail.toLowerCase().includes("does not exist")) {
    throw new Error(
      `mvp_test_projects 테이블이 없습니다. scripts/create_mvp_test_projects_table.sql 을 실행해 주세요. (${detail})`
    )
  }
  throw new Error(`${action} 실패: ${detail}`)
}

export async function getMvpTestProjects(userId: string): Promise<MvpTestProject[]> {
  const supabase = await createMvpProjectsClient()
  const { data, error } = await supabase
    .from("mvp_test_projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) wrapDbError(error, "목록 조회")
  return (data || []) as MvpTestProject[]
}

export async function createMvpTestProject(
  userId: string,
  name: string,
  description?: string,
  data?: MvpTestProjectData
): Promise<MvpTestProject> {
  const supabase = await createMvpProjectsClient()
  const { data: project, error } = await supabase
    .from("mvp_test_projects")
    .insert({
      user_id: userId,
      name,
      description: description || null,
      data: data || {},
    })
    .select()
    .single()

  if (error) wrapDbError(error, "프로젝트 생성")
  return project as MvpTestProject
}

export async function updateMvpTestProject(
  projectId: string,
  updates: {
    name?: string
    description?: string
    data?: MvpTestProjectData
  }
): Promise<MvpTestProject> {
  const supabase = await createMvpProjectsClient()
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.data !== undefined) updateData.data = updates.data

  const { data: project, error } = await supabase
    .from("mvp_test_projects")
    .update(updateData)
    .eq("id", projectId)
    .select()
    .single()

  if (error) wrapDbError(error, "프로젝트 업데이트")
  return project as MvpTestProject
}

export async function deleteMvpTestProject(projectId: string): Promise<void> {
  const supabase = await createMvpProjectsClient()
  const { error } = await supabase.from("mvp_test_projects").delete().eq("id", projectId)

  if (error) wrapDbError(error, "프로젝트 삭제")
}

export async function deleteMvpTestProjects(projectIds: string[]): Promise<void> {
  const ids = [...new Set(projectIds.filter(Boolean))]
  if (!ids.length) return
  const supabase = await createMvpProjectsClient()
  const { error } = await supabase.from("mvp_test_projects").delete().in("id", ids)

  if (error) wrapDbError(error, "프로젝트 일괄 삭제")
}

export async function getMvpTestProject(projectId: string): Promise<MvpTestProject | null> {
  const supabase = await createMvpProjectsClient()
  const { data, error } = await supabase.from("mvp_test_projects").select("*").eq("id", projectId).single()

  if (error) {
    if (error.code === "PGRST116") return null
    wrapDbError(error, "프로젝트 조회")
  }

  return data as MvpTestProject
}
