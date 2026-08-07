"use server"

import { createClient } from "@supabase/supabase-js"
import type { GroupChannel } from "../channel-analysis/lib/types"

/** 공용 고정 그룹 키 */
export type FixedStoryGroupKey = "shopping" | "story-shopping" | "instagram"

export type UserChannelGroupRow = {
  groupKey: string
  groupName: string
  description: string
  channels: GroupChannel[]
}

export type UserStoryChannelsMap = Record<FixedStoryGroupKey, GroupChannel[]>

const FIXED_KEYS: FixedStoryGroupKey[] = ["shopping", "story-shopping", "instagram"]

const EMPTY_MAP: UserStoryChannelsMap = {
  shopping: [],
  "story-shopping": [],
  instagram: [],
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.")
  }
  return createClient(supabaseUrl, supabaseServiceKey)
}

function normalizeChannels(raw: unknown): GroupChannel[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is GroupChannel =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as GroupChannel).channelId === "string" &&
      typeof (item as GroupChannel).channelTitle === "string"
  )
}

function isFixedKey(key: string): key is FixedStoryGroupKey {
  return FIXED_KEYS.includes(key as FixedStoryGroupKey)
}

/** 계정에 저장된 모든 그룹(고정 개인채널 + 커스텀 그룹) */
export async function listUserChannelGroups(userId: string): Promise<UserChannelGroupRow[]> {
  const trimmed = (userId || "").trim()
  if (!trimmed || trimmed === "anonymous") return []

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("story_shopping_user_channels")
      .select("group_key, group_name, description, channels")
      .eq("user_id", trimmed)

    if (error) {
      console.error("[Story User Channels] 목록 조회 실패:", error)
      return []
    }

    return (data || []).map((row) => ({
      groupKey: String(row.group_key || ""),
      groupName: String(row.group_name || row.group_key || ""),
      description: String(row.description || ""),
      channels: normalizeChannels(row.channels),
    })).filter((row) => row.groupKey)
  } catch (error) {
    console.error("[Story User Channels] 목록 조회 중 오류:", error)
    return []
  }
}

/** 고정 그룹용 개인 채널 맵 (하위 호환) */
export async function getUserStoryChannels(userId: string): Promise<UserStoryChannelsMap> {
  const rows = await listUserChannelGroups(userId)
  const next: UserStoryChannelsMap = { ...EMPTY_MAP }
  for (const row of rows) {
    if (isFixedKey(row.groupKey)) {
      next[row.groupKey] = row.channels
    }
  }
  return next
}

/** 그룹 1개 upsert (고정/커스텀 공통) */
export async function upsertUserChannelGroup(
  userId: string,
  row: UserChannelGroupRow
): Promise<{ success: boolean; error?: string }> {
  const trimmed = (userId || "").trim()
  if (!trimmed || trimmed === "anonymous") {
    return { success: false, error: "로그인이 필요합니다." }
  }
  if (!row.groupKey.trim()) {
    return { success: false, error: "그룹 키가 없습니다." }
  }

  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from("story_shopping_user_channels").upsert(
      {
        user_id: trimmed,
        group_key: row.groupKey.trim(),
        group_name: row.groupName.trim() || row.groupKey.trim(),
        description: row.description || "",
        channels: normalizeChannels(row.channels),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,group_key" }
    )

    if (error) {
      console.error("[Story User Channels] 저장 실패:", error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (error) {
    console.error("[Story User Channels] 저장 중 오류:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "저장 실패",
    }
  }
}

/** 한 그룹의 개인 채널 목록 저장 (고정 그룹 전용 헬퍼) */
export async function saveUserStoryChannelsForGroup(
  userId: string,
  groupKey: FixedStoryGroupKey,
  channels: GroupChannel[],
  groupName?: string
): Promise<{ success: boolean; error?: string }> {
  const names: Record<FixedStoryGroupKey, string> = {
    shopping: "쇼핑형",
    "story-shopping": "이야기 쇼핑형",
    instagram: "인스타형",
  }
  return upsertUserChannelGroup(userId, {
    groupKey,
    groupName: groupName || names[groupKey],
    description: "",
    channels,
  })
}

/** 커스텀 그룹 삭제 */
export async function deleteUserChannelGroup(
  userId: string,
  groupKey: string
): Promise<{ success: boolean; error?: string }> {
  const trimmed = (userId || "").trim()
  if (!trimmed || trimmed === "anonymous") {
    return { success: false, error: "로그인이 필요합니다." }
  }
  if (!groupKey.startsWith("custom_")) {
    return { success: false, error: "공용 그룹은 삭제할 수 없습니다." }
  }

  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from("story_shopping_user_channels")
      .delete()
      .eq("user_id", trimmed)
      .eq("group_key", groupKey)

    if (error) {
      console.error("[Story User Channels] 그룹 삭제 실패:", error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (error) {
    console.error("[Story User Channels] 그룹 삭제 중 오류:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "삭제 실패",
    }
  }
}
