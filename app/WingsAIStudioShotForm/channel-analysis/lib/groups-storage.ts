import type { ChannelGroup, GroupChannel, GroupVideo, VideoGroup } from "./types"

const CHANNEL_KEY = "wings_shotform_channel_benchmark_groups_v1"
const VIDEO_KEY = "wings_shotform_video_benchmark_groups_v1"

export function loadChannelGroups(): ChannelGroup[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(CHANNEL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveChannelGroups(groups: ChannelGroup[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(CHANNEL_KEY, JSON.stringify(groups))
}

export function createChannelGroup(name: string): ChannelGroup {
  const now = new Date().toISOString()
  return {
    id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "새 그룹",
    createdAt: now,
    updatedAt: now,
    channels: [],
  }
}

export function upsertGroupChannel(group: ChannelGroup, channel: GroupChannel): ChannelGroup {
  const exists = group.channels.some((c) => c.channelId === channel.channelId)
  const channels = exists
    ? group.channels.map((c) =>
        c.channelId === channel.channelId
          ? {
              ...c,
              ...channel,
              videos: channel.videos?.length ? channel.videos : c.videos,
            }
          : c
      )
    : [...group.channels, channel]
  return { ...group, channels, updatedAt: new Date().toISOString() }
}

/** 채널을 지정 그룹에 즐겨찾기 (없으면 그룹 생성용 id 전달) */
export function addChannelToGroupId(
  groupId: string,
  channel: GroupChannel,
  groups = loadChannelGroups()
): ChannelGroup[] {
  return groups.map((g) => (g.id === groupId ? upsertGroupChannel(g, channel) : g))
}

export function loadVideoGroups(): VideoGroup[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(VIDEO_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveVideoGroups(groups: VideoGroup[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(VIDEO_KEY, JSON.stringify(groups))
}

export function createVideoGroup(name: string): VideoGroup {
  const now = new Date().toISOString()
  return {
    id: `vgrp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "새 관심 영상",
    createdAt: now,
    updatedAt: now,
    videos: [],
  }
}

export function upsertGroupVideo(group: VideoGroup, video: GroupVideo): VideoGroup {
  const exists = group.videos.some((v) => v.videoId === video.videoId)
  const videos = exists
    ? group.videos.map((v) => (v.videoId === video.videoId ? { ...v, ...video } : v))
    : [...group.videos, video]
  return { ...group, videos, updatedAt: new Date().toISOString() }
}

export function addVideoToGroupId(
  groupId: string,
  video: GroupVideo,
  groups = loadVideoGroups()
): VideoGroup[] {
  return groups.map((g) => (g.id === groupId ? upsertGroupVideo(g, video) : g))
}

export function trendingToGroupVideo(v: {
  id: string
  title: string
  thumbnail: string
  viewCount: number
  likeCount: number
  publishedAt: string
  channelId: string
  channelTitle: string
  channelThumb?: string
}): GroupVideo {
  return {
    videoId: v.id,
    title: v.title,
    thumbnailUrl: v.thumbnail,
    viewCount: v.viewCount,
    likeCount: v.likeCount,
    publishedAt: v.publishedAt,
    channelId: v.channelId,
    channelTitle: v.channelTitle,
    channelThumb: v.channelThumb,
    savedAt: new Date().toISOString(),
  }
}
