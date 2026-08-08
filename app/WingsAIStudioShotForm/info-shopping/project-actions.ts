"use server"

import { createClient } from "@/lib/supabase/server"
import {
  isWithinShoppingProjectRetention,
  purgeExpiredShoppingProjects,
} from "@/lib/shopping-projects-retention"
import type { InfoActiveStep } from "./info-steps"
import type { InfoShoppingBrief } from "./info-types"

export type { InfoActiveStep } from "./info-steps"

export interface ShoppingProject {
  id: string
  user_id: string
  name: string
  description?: string
  data: InfoProjectData
  created_at: string
  updated_at: string
}

export interface InfoProjectData {
  infoBrief?: InfoShoppingBrief
  productName?: string
  productDescription?: string
  productImage?: string
  productUrl?: string
  activeStep?: InfoActiveStep
  completedSteps?: string[]
  appVariant?: "ver1" | "ver2" | "story" | "animal" | "info"
  exportedVideoUrl?: string
}

export async function getShoppingProjects(userId: string): Promise<ShoppingProject[]> {
  try {
    await purgeExpiredShoppingProjects()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("shopping_projects")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })

    if (error) throw error
    return (data || []).filter(
      (project) =>
        project.data?.appVariant === "info" &&
        isWithinShoppingProjectRetention(project.created_at)
    )
  } catch (error) {
    console.error("[Info Shopping] 프로젝트 목록 조회 실패:", error)
    throw error
  }
}

export async function createShoppingProject(
  userId: string,
  name: string,
  description?: string,
  data?: InfoProjectData
): Promise<ShoppingProject> {
  try {
    const supabase = await createClient()
    const { data: project, error } = await supabase
      .from("shopping_projects")
      .insert({
        user_id: userId,
        name,
        description: description || null,
        data: { ...(data || {}), appVariant: "info" },
      })
      .select()
      .single()

    if (error) throw error
    return project
  } catch (error) {
    console.error("[Info Shopping] 프로젝트 생성 실패:", error)
    throw error
  }
}

export async function getShoppingProject(projectId: string): Promise<ShoppingProject | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("shopping_projects")
      .select("*")
      .eq("id", projectId)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw error
    }
    return data
  } catch (error) {
    console.error("[Info Shopping] 프로젝트 조회 실패:", error)
    throw error
  }
}

export async function updateShoppingProject(
  projectId: string,
  updates: {
    name?: string
    description?: string
    data?: InfoProjectData
  }
): Promise<ShoppingProject> {
  try {
    const supabase = await createClient()
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.data !== undefined) {
      updateData.data = { ...updates.data, appVariant: "info" }
    }

    const { data: project, error } = await supabase
      .from("shopping_projects")
      .update(updateData)
      .eq("id", projectId)
      .select()
      .single()

    if (error) throw error
    return project
  } catch (error) {
    console.error("[Info Shopping] 프로젝트 업데이트 실패:", error)
    throw error
  }
}

export async function deleteShoppingProject(projectId: string): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from("shopping_projects").delete().eq("id", projectId)
    if (error) throw error
  } catch (error) {
    console.error("[Info Shopping] 프로젝트 삭제 실패:", error)
    throw error
  }
}

export async function uploadTTSAudio(
  userId: string,
  projectId: string,
  audioBase64: string,
  fileName: string
): Promise<string> {
  const supabase = await createClient()
  const buffer = Buffer.from(
    audioBase64.replace(/^data:audio\/\w+;base64,/, ""),
    "base64"
  )
  const path = `info-shopping/${userId}/${projectId}/${fileName}`
  const { error } = await supabase.storage.from("shotform-assets").upload(path, buffer, {
    contentType: "audio/mpeg",
    upsert: true,
  })
  if (error) throw error
  const { data } = supabase.storage.from("shotform-assets").getPublicUrl(path)
  return data.publicUrl
}
