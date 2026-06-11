import textSubtitleSample from "@/lib/capcut-templates/text-subtitle-sample.json"
import type { VoiceLineCue } from "@/lib/shotform-factory-line-tts"

export type CapCutSubtitleCue = {
  startSec: number
  endSec: number
  text: string
}

export type CapCutNativeDraftInput = {
  draftName: string
  draftRootPath: string
  durationUs: number
  /** `draft_content.json` 미디어 path용. 지정 시 `…/Resources/파일명` 절대 경로(슬래시). 미지정 시 placeholder( ZIP 등 ). */
  absoluteDraftFolderPath?: string
  video?: {
    fileName: string
    width: number
    height: number
    /** 타임라인에 차지하는 길이(보통 TTS와 동일) */
    durationUs: number
    /** 원본 MP4 길이. TTS보다 짧으면 `speed`로 슬로모션(동기 프리뷰와 동일) */
    sourceDurationUs?: number
    speed?: number
  }
  audio?: {
    fileName: string
    /** 타임라인에 올라가는 길이(동기 프리뷰 = 영상 길이) */
    durationUs: number
    /** 원본 파일 길이. `speed`로 영상에 맞출 때만 `durationUs`보다 큼 */
    sourceDurationUs?: number
    /** 1 초과 시 빠르게 재생해 `source`를 `durationUs` 안에 맞춤 */
    speed?: number
    /** 0–1, 기본 1 */
    volume?: number
  }
  /** TTS와 별도로 깔 배경음(믹스본에 이미 포함된 경우 생략) */
  bgm?: {
    fileName: string
    durationUs: number
    volume?: number
  }
  subtitles: CapCutSubtitleCue[]
}

export type CapCutNativeDraftBundle = {
  folderName: string
  draftId: string
  contentId: string
  placeholderId: string
  foldPath: string
  files: Record<string, string | Blob>
}

const ATTACHMENT_PC_COMMON = JSON.stringify(
  {
    ai_packaging_infos: [],
    ai_packaging_report_info: {
      caption_id_list: [],
      commercial_material: "",
      material_source: "",
      method: "",
      page_from: "",
      style: "",
      task_id: "",
      text_style: "",
      tos_id: "",
      video_category: "",
    },
    broll: {
      ai_packaging_infos: [],
      ai_packaging_report_info: {
        caption_id_list: [],
        commercial_material: "",
        material_source: "",
        method: "",
        page_from: "",
        style: "",
        task_id: "",
        text_style: "",
        tos_id: "",
        video_category: "",
      },
    },
    commercial_music_category_ids: [],
    pc_feature_flag: 0,
    recognize_tasks: [],
    reference_lines_config: {
      horizontal_lines: [],
      is_lock: false,
      is_visible: false,
      vertical_lines: [],
    },
    safe_area_type: 0,
    template_item_infos: [],
    unlock_template_ids: [],
  },
  null,
  0
)

const DRAFT_AGENCY_CONFIG = JSON.stringify(
  {
    is_auto_agency_enabled: false,
    is_auto_agency_popup: false,
    is_single_agency_mode: false,
    marterials: null,
    use_converter: true,
    video_resolution: 720,
  },
  null,
  0
)

const PERFORMANCE_OPT_INFO = JSON.stringify(
  { manual_cancle_precombine_segs: null, need_auto_precombine_segs: null },
  null,
  0
)

const KEY_VALUE = JSON.stringify(
  { draft_common_info_key: { enterSource: "browser", funcFeature: "", videoCollapsedFlag: 0 } },
  null,
  0
)

/** 1×1 JPEG — CapCut 썸네일 placeholder */
const MINIMAL_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIVFhUVFRUVFRUVFRUWFhUYFxgYFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lICUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAEBAQEAAAAAAAAAAAAAAAAAAQID/8QAFhABAQEAAAAAAAAAAAAAAAAAAAER/9oADAMBAAIQAxAAAAGoAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z"

export function capCutUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().toUpperCase()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  }).toUpperCase()
}

export function secondsToCapCutUs(seconds: number): number {
  return Math.max(1, Math.round(Math.max(0, seconds) * 1_000_000))
}

export function normalizeCapCutPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "")
}

export function capCutFoldPath(rootPath: string, folderName: string): string {
  return `${normalizeCapCutPath(rootPath)}/${folderName}`
}

export function capCutFilePath(foldPath: string, fileName: string): string {
  return `${normalizeCapCutPath(foldPath)}\\${fileName}`
}

/** ZIP 등 `absoluteDraftFolderPath` 없을 때 — 프로젝트 폴더 기준 `Resources/…` 상대 경로 */
function draftPlaceholderPath(_placeholderId: string, relativeWithinDraft: string): string {
  return relativeWithinDraft.replace(/\\/g, "/").replace(/^\/+/, "")
}

export function draftMediaFilePath(
  absoluteDraftFolderPath: string | undefined,
  placeholderId: string,
  fileName: string
): string {
  if (absoluteDraftFolderPath) {
    return `${normalizeCapCutPath(absoluteDraftFolderPath)}/Resources/${fileName.replace(/\\/g, "/")}`
  }
  return draftPlaceholderPath(placeholderId, `Resources/${fileName}`)
}

export function capCutNowMicros(): number {
  return Date.now() * 1000
}

export function capCutNowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

export function sanitizeCapCutDraftName(label: string): string {
  const cleaned = label
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48)
  return cleaned || "ShotForm"
}

export function defaultShotFormDraftFolderName(label?: string): string {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  const base = sanitizeCapCutDraftName(label ?? "ShotForm")
  return `ShotForm_${base}_${mm}${dd}_${Date.now()}`
}

export function voiceLineCuesToCapCutSubtitles(cues: VoiceLineCue[]): CapCutSubtitleCue[] {
  return cues.map((c) => ({
    startSec: c.startSec,
    endSec: c.endSec,
    text: c.text.replace(/\r/g, "").replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim(),
  }))
}

export async function getBlobMediaDurationSec(blob: Blob, kind: "video" | "audio"): Promise<number | null> {
  if (typeof document === "undefined") return null
  const url = URL.createObjectURL(blob)
  try {
    if (kind === "video") {
      return await new Promise<number>((resolve, reject) => {
        const el = document.createElement("video")
        el.preload = "metadata"
        el.onloadedmetadata = () => resolve(el.duration)
        el.onerror = () => reject(new Error("video metadata"))
        el.src = url
      })
    }
    return await new Promise<number>((resolve, reject) => {
      const el = document.createElement("audio")
      el.preload = "metadata"
      el.onloadedmetadata = () => resolve(el.duration)
      el.onerror = () => reject(new Error("audio metadata"))
      el.src = url
    })
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function getUrlMediaDurationSec(url: string, kind: "video" | "audio"): Promise<number | null> {
  if (typeof document === "undefined") return null
  try {
    if (kind === "video") {
      return await new Promise<number>((resolve, reject) => {
        const el = document.createElement("video")
        el.preload = "metadata"
        el.crossOrigin = "anonymous"
        el.onloadedmetadata = () => resolve(el.duration)
        el.onerror = () => reject(new Error("video metadata"))
        el.src = url
      })
    }
    return await new Promise<number>((resolve, reject) => {
      const el = document.createElement("audio")
      el.preload = "metadata"
      el.crossOrigin = "anonymous"
      el.onloadedmetadata = () => resolve(el.duration)
      el.onerror = () => reject(new Error("audio metadata"))
      el.src = url
    })
  } catch {
    return null
  }
}

function buildCapCutTextContent(text: string): string {
  const len = Math.max(1, text.length)
  return JSON.stringify({
    styles: [
      {
        fill: {
          alpha: 1,
          content: {
            render_type: "solid",
            solid: { alpha: 1, color: [1, 0.906, 0.227] },
          },
        },
        font: { id: "", path: "" },
        range: [0, len],
        size: 10,
        useLetterColor: true,
        background: {
          alpha: 0.7,
          color: [0, 0, 0],
          height: 0.14,
          horizontal_offset: 0.5,
          round_radius: 0,
          style: 1,
          vertical_offset: 0.5,
          width: 0.14,
        },
      },
    ],
    text,
  })
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function buildTextMaterial(text: string) {
  const material = cloneJson(textSubtitleSample.material) as Record<string, unknown>
  const content = buildCapCutTextContent(text)
  material.id = capCutUuid()
  material.content = content
  material.base_content = content
  material.name = text.slice(0, 40)
  return material
}

function buildTextSegment(materialId: string, startUs: number, durationUs: number, renderIndex: number) {
  const segment = cloneJson(textSubtitleSample.segment) as Record<string, unknown>
  segment.id = capCutUuid()
  segment.material_id = materialId
  segment.target_timerange = { start: startUs, duration: durationUs }
  segment.render_index = renderIndex
  return segment
}

function buildVideoMaterial(input: {
  id: string
  path: string
  fileName: string
  width: number
  height: number
  durationUs: number
  localMaterialId: string
}) {
  return {
    id: input.id,
    unique_id: "",
    type: "video",
    duration: input.durationUs,
    path: input.path,
    media_path: "",
    local_id: "",
    has_audio: true,
    reverse_path: "",
    intensifies_path: "",
    reverse_intensifies_path: "",
    intensifies_audio_path: "",
    cartoon_path: "",
    width: input.width,
    height: input.height,
    category_id: "",
    category_name: "local",
    material_id: "",
    material_name: input.fileName,
    material_url: "",
    crop: {
      upper_left_x: 0,
      upper_left_y: 0,
      upper_right_x: 1,
      upper_right_y: 0,
      lower_left_x: 0,
      lower_left_y: 1,
      lower_right_x: 1,
      lower_right_y: 1,
    },
    crop_ratio: "free",
    audio_fade: null,
    crop_scale: 1,
    extra_type_option: 0,
    stable: { stable_level: 0, matrix_path: "", time_range: { start: 0, duration: 0 } },
    matting: {
      flag: 0,
      path: "",
      interactiveTime: [],
      has_use_quick_brush: false,
      strokes: [],
      has_use_quick_eraser: false,
      expansion: 0,
      feather: 0,
      reverse: false,
      custom_matting_id: "",
      enable_matting_stroke: false,
    },
    source: 0,
    source_platform: 0,
    formula_id: "",
    check_flag: 62978047,
    local_material_id: input.localMaterialId,
    origin_material_id: "",
    request_id: "",
    has_sound_separated: false,
    is_text_edit_overdub: false,
    is_ai_generate_content: false,
    aigc_type: "none",
    is_copyright: false,
  }
}

function buildAudioMaterial(input: {
  id: string
  path: string
  fileName: string
  durationUs: number
}) {
  return {
    id: input.id,
    unique_id: "",
    type: "extract_music",
    name: input.fileName,
    duration: input.durationUs,
    path: input.path,
    category_name: "",
    wave_points: [],
    music_id: "",
    app_id: 0,
    text_id: "",
    tone_type: "",
    source_platform: 0,
    video_id: "",
    effect_id: "",
    resource_id: "",
    third_resource_id: "",
    category_id: "",
    intensifies_path: "",
    formula_id: "",
    check_flag: 1,
    team_id: "",
    local_material_id: "",
  }
}

function buildVideoSegment(
  materialId: string,
  targetDurationUs: number,
  extraMaterialRefs: string[],
  speed = 1,
  sourceDurationUs?: number
) {
  const sourceUs = sourceDurationUs ?? targetDurationUs
  return {
    id: capCutUuid(),
    source_timerange: { start: 0, duration: sourceUs },
    target_timerange: { start: 0, duration: targetDurationUs },
    render_timerange: { start: 0, duration: 0 },
    desc: "",
    state: 0,
    speed,
    is_loop: false,
    is_tone_modify: false,
    reverse: false,
    intensifies_audio: false,
    cartoon: false,
    volume: 1,
    last_nonzero_volume: 1,
    clip: {
      scale: { x: 1, y: 1 },
      rotation: 0,
      transform: { x: 0, y: 0 },
      flip: { vertical: false, horizontal: false },
      alpha: 1,
    },
    uniform_scale: { on: true, value: 1 },
    material_id: materialId,
    extra_material_refs: extraMaterialRefs,
    render_index: 0,
    keyframe_refs: [],
    enable_lut: true,
    enable_adjust: true,
    enable_hsl: false,
    visible: true,
    group_id: "",
    enable_color_curves: true,
    enable_hsl_curves: true,
    track_render_index: 0,
    hdr_settings: { mode: 1, intensity: 1, nits: 1000 },
    enable_color_wheels: true,
    track_attribute: 0,
    is_placeholder: false,
    template_id: "",
    enable_smart_color_adjust: false,
    template_scene: "default",
    common_keyframes: [],
    caption_info: null,
    responsive_layout: {
      enable: false,
      target_follow: "",
      size_layout: 0,
      horizontal_pos_layout: 0,
      vertical_pos_layout: 0,
    },
    enable_color_match_adjust: false,
    enable_color_correct_adjust: false,
    enable_adjust_mask: false,
    raw_segment_id: "",
    lyric_keyframes: null,
    enable_video_mask: true,
    digital_human_template_group_id: "",
    color_correct_alg_result: "",
    source: "segmentsourcenormal",
    enable_mask_stroke: false,
    enable_mask_shadow: false,
    enable_color_adjust_pro: false,
  }
}

function buildAudioSegment(
  materialId: string,
  targetDurationUs: number,
  trackRenderIndex: number,
  extraMaterialRefs: string[],
  volume = 1,
  speed = 1,
  sourceDurationUs?: number
) {
  const sourceUs = sourceDurationUs ?? targetDurationUs
  return {
    id: capCutUuid(),
    source_timerange: { start: 0, duration: sourceUs },
    target_timerange: { start: 0, duration: targetDurationUs },
    render_timerange: { start: 0, duration: 0 },
    desc: "",
    state: 0,
    speed,
    is_loop: false,
    is_tone_modify: false,
    reverse: false,
    intensifies_audio: false,
    cartoon: false,
    volume,
    last_nonzero_volume: volume,
    clip: null,
    uniform_scale: null,
    material_id: materialId,
    extra_material_refs: extraMaterialRefs,
    render_index: 0,
    keyframe_refs: [],
    enable_lut: false,
    enable_adjust: false,
    enable_hsl: false,
    visible: true,
    group_id: "",
    enable_color_curves: true,
    enable_hsl_curves: true,
    track_render_index: trackRenderIndex,
    hdr_settings: null,
    enable_color_wheels: true,
    track_attribute: 0,
    is_placeholder: false,
    template_id: "",
    enable_smart_color_adjust: false,
    template_scene: "default",
    common_keyframes: [],
    caption_info: null,
    responsive_layout: {
      enable: false,
      target_follow: "",
      size_layout: 0,
      horizontal_pos_layout: 0,
      vertical_pos_layout: 0,
    },
    enable_color_match_adjust: false,
    enable_color_correct_adjust: false,
    enable_adjust_mask: false,
    raw_segment_id: "",
    lyric_keyframes: null,
    enable_video_mask: false,
    digital_human_template_group_id: "",
    color_correct_alg_result: "",
    source: "segmentsourcenormal",
    enable_mask_stroke: false,
    enable_mask_shadow: false,
    enable_color_adjust_pro: false,
  }
}

export function buildCapCutDraftContent(
  input: CapCutNativeDraftInput & {
    contentId: string
    placeholderId: string
  }
) {
  const speedId = capCutUuid()
  const canvasId = capCutUuid()
  const placeholderInfoId = capCutUuid()
  const soundChannelId = capCutUuid()
  const materialColorId = capCutUuid()
  const vocalSepId = capCutUuid()

  const tracks: Array<Record<string, unknown>> = []
  const materials: Record<string, unknown[]> = {
    videos: [],
    audios: [],
    texts: [],
    speeds: [{ id: speedId, type: "speed", mode: 0, speed: 1, curve_speed: null }],
    canvases: [
      {
        id: canvasId,
        type: "canvas_color",
        color: "",
        blur: 0,
        image: "",
        album_image: "",
        image_id: "",
        image_name: "",
        source_platform: 0,
        team_id: "",
      },
    ],
    placeholder_infos: [
      {
        id: placeholderInfoId,
        type: "placeholder_info",
        meta_type: "none",
        res_path: "",
        res_text: "",
        error_path: "",
        error_text: "",
      },
    ],
    sound_channel_mappings: [
      { id: soundChannelId, type: "", audio_channel_mapping: 0, is_config_open: false },
    ],
    material_colors: [
      {
        id: materialColorId,
        is_color_clip: false,
        is_gradient: false,
        solid_color: "",
        gradient_colors: [],
        gradient_percents: [],
        gradient_angle: 90,
        width: 0,
        height: 0,
      },
    ],
    vocal_separations: [
      {
        id: vocalSepId,
        type: "vocal_separation",
        choice: 0,
        removed_sounds: [],
        time_range: null,
        production_path: "",
        final_algorithm: "",
        enter_from: "",
      },
    ],
  }

  const extraRefs = [speedId, placeholderInfoId, canvasId, soundChannelId, materialColorId, vocalSepId]

  if (input.video) {
    const videoMaterialId = capCutUuid()
    const localMaterialId = capCutUuid().toLowerCase()
    const videoPath = draftMediaFilePath(input.absoluteDraftFolderPath, input.placeholderId, input.video.fileName)
    const videoSourceUs = input.video.sourceDurationUs ?? input.video.durationUs
    materials.videos!.push(
      buildVideoMaterial({
        id: videoMaterialId,
        path: videoPath,
        fileName: input.video.fileName,
        width: input.video.width,
        height: input.video.height,
        durationUs: videoSourceUs,
        localMaterialId,
      })
    )
    tracks.push({
      id: capCutUuid(),
      type: "video",
      segments: [
        buildVideoSegment(
          videoMaterialId,
          input.video.durationUs,
          extraRefs,
          input.video.speed ?? 1,
          videoSourceUs
        ),
      ],
      flag: 0,
      attribute: 0,
      name: "",
      is_default_name: true,
    })
  }

  if (input.audio) {
    const audioMaterialId = capCutUuid()
    const audioPath = draftMediaFilePath(input.absoluteDraftFolderPath, input.placeholderId, input.audio.fileName)
    const audioSourceUs = input.audio.sourceDurationUs ?? input.audio.durationUs
    materials.audios!.push(
      buildAudioMaterial({
        id: audioMaterialId,
        path: audioPath,
        fileName: input.audio.fileName,
        durationUs: audioSourceUs,
      })
    )
    tracks.push({
      id: capCutUuid(),
      type: "audio",
      segments: [
        buildAudioSegment(
          audioMaterialId,
          input.audio.durationUs,
          tracks.length,
          extraRefs,
          input.audio.volume ?? 1,
          input.audio.speed ?? 1,
          audioSourceUs
        ),
      ],
      flag: 0,
      attribute: 0,
      name: "",
      is_default_name: true,
    })
  }

  if (input.bgm) {
    const bgmMaterialId = capCutUuid()
    const bgmPath = draftMediaFilePath(input.absoluteDraftFolderPath, input.placeholderId, input.bgm.fileName)
    materials.audios!.push(
      buildAudioMaterial({
        id: bgmMaterialId,
        path: bgmPath,
        fileName: input.bgm.fileName,
        durationUs: input.bgm.durationUs,
      })
    )
    tracks.push({
      id: capCutUuid(),
      type: "audio",
      segments: [
        buildAudioSegment(
          bgmMaterialId,
          input.bgm.durationUs,
          tracks.length,
          extraRefs,
          input.bgm.volume ?? 0.22
        ),
      ],
      flag: 0,
      attribute: 0,
      name: "",
      is_default_name: true,
    })
  }

  if (input.subtitles.length > 0) {
    const textSegments: Record<string, unknown>[] = []
    input.subtitles.forEach((cue, index) => {
      if (!cue.text.trim()) return
      const material = buildTextMaterial(cue.text)
      materials.texts!.push(material)
      textSegments.push(
        buildTextSegment(
          material.id as string,
          secondsToCapCutUs(cue.startSec),
          secondsToCapCutUs(Math.max(0.2, cue.endSec - cue.startSec)),
          14000 + index
        )
      )
    })
    if (textSegments.length > 0) {
      const textTrack = cloneJson(textSubtitleSample.track) as Record<string, unknown>
      textTrack.id = capCutUuid()
      textTrack.segments = textSegments
      tracks.push(textTrack)
    }
  }

  const emptyMaterialLists = [
    "flowers",
    "tail_leaders",
    "images",
    "effects",
    "stickers",
    "transitions",
    "audio_effects",
    "audio_fades",
    "beats",
    "material_animations",
    "placeholders",
    "common_mask",
    "chromas",
    "text_templates",
    "realtime_denoises",
    "audio_pannings",
    "audio_pitch_shifts",
    "video_trackings",
    "hsl",
    "drafts",
    "color_curves",
    "hsl_curves",
    "primary_color_wheels",
    "log_color_wheels",
    "video_effects",
    "audio_balances",
    "handwrites",
    "manual_deformations",
    "manual_beautys",
    "plugin_effects",
    "green_screens",
    "shapes",
    "digital_humans",
    "digital_human_model_dressing",
    "smart_crops",
    "ai_translates",
    "audio_track_indexes",
    "loudnesses",
    "vocal_beautifys",
    "smart_relights",
    "time_marks",
    "multi_language_refs",
    "video_shadows",
    "video_strokes",
    "video_radius",
  ]
  emptyMaterialLists.forEach((key) => {
    materials[key] = []
  })

  return {
    id: input.contentId,
    version: 360000,
    new_version: "167.0.0",
    name: "",
    duration: input.durationUs,
    create_time: 0,
    update_time: 0,
    fps: 30,
    is_drop_frame_timecode: false,
    color_space: 0,
    config: {
      video_mute: false,
      record_audio_last_index: 1,
      extract_audio_last_index: 1,
      original_sound_last_index: 1,
      subtitle_recognition_id: "",
      subtitle_taskinfo: [],
      lyrics_recognition_id: "",
      lyrics_taskinfo: [],
      subtitle_sync: true,
      lyrics_sync: true,
      voice_change_sync: false,
      sticker_max_index: 1,
      adjust_max_index: 1,
      material_save_mode: 1,
      export_range: null,
      maintrack_adsorb: true,
      combination_max_index: 1,
      attachment_info: [],
      zoom_info_params: null,
      system_font_list: [],
      multi_language_mode: "none",
      multi_language_main: "none",
      multi_language_current: "none",
      multi_language_list: [],
      subtitle_keywords_config: null,
      use_float_render: false,
    },
    canvas_config: {
      ratio: "9:16",
      width: 1080,
      height: 1920,
      background: null,
    },
    tracks,
    group_container: null,
    materials,
    keyframes: {
      videos: [],
      audios: [],
      texts: [],
      stickers: [],
      filters: [],
      adjusts: [],
      handwrites: [],
      effects: [],
    },
    keyframe_graph_list: [],
    platform: {
      os: "windows",
      os_version: "10.0.22631",
      app_id: 359289,
      app_version: "8.5.0",
      app_source: "cc",
      device_id: "",
      hard_disk_id: "",
      mac_address: "",
    },
    last_modified_platform: {
      os: "windows",
      os_version: "10.0.22631",
      app_id: 359289,
      app_version: "8.5.0",
      app_source: "cc",
      device_id: "",
      hard_disk_id: "",
      mac_address: "",
    },
    mutable_config: null,
    cover: null,
    retouch_cover: null,
    extra_info: null,
    relationships: [],
    render_index_track_mode_on: true,
    free_render_index_mode_on: false,
    static_cover_image_path: "",
    source: "default",
    time_marks: null,
    path: "",
    lyrics_effects: [],
    uneven_animation_template_info: {
      composition: "",
      content: "",
      order: "",
      sub_template_info_list: [],
    },
    draft_type: "video",
    smart_ads_info: { page_from: "", routine: "", draft_url: "" },
    function_assistant_info: {
      smart_rec_applied: false,
      fixed_rec_applied: false,
      auto_adjust: false,
      auto_adjust_segid_list: [],
      color_correction: false,
      color_correction_segid_list: [],
      enhance_quality: false,
      smooth_slow_motion: false,
      deflicker_segid_list: [],
      video_noise_segid_list: [],
      enhance_quality_segid_list: [],
      smart_segid_list: [],
      retouch: false,
      retouch_segid_list: [],
      enhande_voice: false,
      enhance_voice_segid_list: [],
      audio_noise_segid_list: [],
      auto_caption: false,
      auto_caption_segid_list: [],
      auto_caption_template_id: "",
      caption_opt: false,
      caption_opt_segid_list: [],
      eye_correction: false,
      eye_correction_segid_list: [],
      normalize_loudness: false,
      normalize_loudness_segid_list: [],
      normalize_loudness_audio_denoise_segid_list: [],
      auto_adjust_fixed: false,
      auto_adjust_fixed_value: 50,
      color_correction_fixed: false,
      color_correction_fixed_value: 50,
      normalize_loudness_fixed: false,
      enhande_voice_fixed: false,
      retouch_fixed: false,
      enhance_quality_fixed: false,
      smooth_slow_motion_fixed: false,
      fps: { num: 0, den: 1 },
    },
  }
}

export function buildCapCutDraftMetaInfo(input: {
  draftId: string
  draftName: string
  foldPath: string
  draftRootPath: string
  durationUs: number
  timelineMaterialsSize: number
  nowMicros?: number
}) {
  const now = input.nowMicros ?? capCutNowMicros()
  return {
    cloud_draft_cover: false,
    cloud_draft_sync: false,
    cloud_package_completed_time: "",
    draft_cloud_capcut_purchase_info: "",
    draft_cloud_last_action_download: false,
    draft_cloud_package_type: "",
    draft_cloud_purchase_info: "",
    draft_cloud_template_id: "",
    draft_cloud_tutorial_info: "",
    draft_cloud_videocut_purchase_info: "",
    draft_cover: "draft_cover.jpg",
    draft_deeplink_url: "",
    draft_enterprise_info: {
      draft_enterprise_extra: "",
      draft_enterprise_id: "",
      draft_enterprise_name: "",
      enterprise_material: [],
    },
    draft_fold_path: normalizeCapCutPath(input.foldPath),
    draft_id: input.draftId,
    draft_is_ae_produce: false,
    draft_is_ai_packaging_used: false,
    draft_is_ai_shorts: false,
    draft_is_ai_translate: false,
    draft_is_article_video_draft: false,
    draft_is_cloud_temp_draft: false,
    draft_is_from_deeplink: "false",
    draft_is_invisible: false,
    draft_is_web_article_video: false,
    draft_materials: [
      { type: 0, value: [] },
      { type: 1, value: [] },
      { type: 2, value: [] },
      { type: 3, value: [] },
      { type: 6, value: [] },
      { type: 7, value: [] },
      { type: 8, value: [] },
    ],
    draft_materials_copied_info: [],
    draft_name: input.draftName,
    draft_need_rename_folder: false,
    draft_new_version: "167.0.0",
    draft_removable_storage_device: "",
    draft_root_path: input.draftRootPath,
    draft_segment_extra_info: [],
    draft_timeline_materials_size_: input.timelineMaterialsSize,
    draft_type: "",
    draft_web_article_video_enter_from: "",
    tm_draft_cloud_completed: "",
    tm_draft_cloud_entry_id: -1,
    tm_draft_cloud_modified: 0,
    tm_draft_cloud_parent_entry_id: -1,
    tm_draft_cloud_space_id: -1,
    tm_draft_cloud_user_id: -1,
    tm_draft_create: now,
    tm_draft_modified: now,
    tm_draft_removed: 0,
    tm_duration: input.durationUs,
  }
}

export function buildRootMetaDraftEntry(input: {
  draftId: string
  draftName: string
  foldPath: string
  draftRootPath: string
  durationUs: number
  timelineMaterialsSize: number
  nowMicros?: number
}) {
  const now = input.nowMicros ?? capCutNowMicros()
  const fold = normalizeCapCutPath(input.foldPath)
  return {
    cloud_draft_cover: false,
    cloud_draft_sync: false,
    draft_cloud_last_action_download: false,
    draft_cloud_purchase_info: "",
    draft_cloud_template_id: "",
    draft_cloud_tutorial_info: "",
    draft_cloud_videocut_purchase_info: "",
    draft_cover: capCutFilePath(fold, "draft_cover.jpg"),
    draft_fold_path: fold,
    draft_id: input.draftId,
    draft_is_ai_shorts: false,
    draft_is_cloud_temp_draft: false,
    draft_is_invisible: false,
    draft_is_web_article_video: false,
    draft_json_file: capCutFilePath(fold, "draft_content.json"),
    draft_name: input.draftName,
    draft_new_version: "167.0.0",
    draft_root_path: input.draftRootPath,
    draft_timeline_materials_size: input.timelineMaterialsSize,
    draft_type: "",
    draft_web_article_video_enter_from: "",
    streaming_edit_draft_ready: true,
    tm_draft_cloud_completed: "",
    tm_draft_cloud_entry_id: -1,
    tm_draft_cloud_modified: 0,
    tm_draft_cloud_parent_entry_id: -1,
    tm_draft_cloud_space_id: -1,
    tm_draft_cloud_user_id: -1,
    tm_draft_create: now,
    tm_draft_modified: now,
    tm_duration: input.durationUs,
  }
}

export function upsertRootMetaStore(
  store: Array<Record<string, unknown>>,
  entry: Record<string, unknown>
): Array<Record<string, unknown>> {
  const foldPath = entry.draft_fold_path as string
  const filtered = store.filter((item) => item.draft_fold_path !== foldPath)
  return [entry, ...filtered]
}

export async function readDraftRootPathFromHandle(
  draftsRootHandle: FileSystemDirectoryHandle
): Promise<string | null> {
  try {
    const fh = await draftsRootHandle.getFileHandle("root_meta_info.json")
    const file = await fh.getFile()
    const root = JSON.parse(await file.text()) as {
      all_draft_store?: Array<{ draft_root_path?: string; tm_draft_modified?: number }>
    }
    const items = root.all_draft_store ?? []
    if (items.length === 0) return null
    const sorted = [...items].sort(
      (a, b) => (b.tm_draft_modified ?? 0) - (a.tm_draft_modified ?? 0)
    )
    const path = sorted[0]?.draft_root_path
    return path ? normalizeCapCutPath(path) : null
  } catch {
    return null
  }
}

export async function readRootMetaStore(
  draftsRootHandle: FileSystemDirectoryHandle
): Promise<Array<Record<string, unknown>>> {
  try {
    const fh = await draftsRootHandle.getFileHandle("root_meta_info.json")
    const file = await fh.getFile()
    const root = JSON.parse(await file.text()) as { all_draft_store?: Array<Record<string, unknown>> }
    return root.all_draft_store ?? []
  } catch {
    return []
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function buildCapCutNativeDraftBundle(
  input: CapCutNativeDraftInput & {
    folderName: string
    mediaBlobs: Record<string, Blob>
    /** PC drafts 폴더에 직접 쓸 때 true → 미디어 절대 경로로 저장해 CapCut이 파일을 찾음 */
    useAbsoluteMediaPaths?: boolean
  }
): CapCutNativeDraftBundle {
  const { folderName, mediaBlobs, useAbsoluteMediaPaths, ...draftFields } = input
  const draftId = capCutUuid()
  const contentId = capCutUuid()
  const placeholderId = contentId
  const foldPath = capCutFoldPath(draftFields.draftRootPath, folderName)
  const timelineMaterialsSize = Object.values(mediaBlobs).reduce((sum, blob) => sum + blob.size, 0)
  const nowMicros = capCutNowMicros()
  const nowSec = capCutNowSeconds()

  const absoluteDraftFolderPath =
    useAbsoluteMediaPaths ? normalizeCapCutPath(foldPath) : undefined

  const draftContent = buildCapCutDraftContent({
    ...draftFields,
    contentId,
    placeholderId,
    absoluteDraftFolderPath,
  })
  const draftContentJson = JSON.stringify(draftContent)
  const draftMeta = buildCapCutDraftMetaInfo({
    draftId,
    draftName: draftFields.draftName,
    foldPath,
    draftRootPath: draftFields.draftRootPath,
    durationUs: draftFields.durationUs,
    timelineMaterialsSize,
    nowMicros,
  })

  const files: Record<string, string | Blob> = {
    "draft_content.json": draftContentJson,
    "draft_content.json.bak": draftContentJson,
    "template-2.tmp": draftContentJson,
    "draft_meta_info.json": JSON.stringify(draftMeta),
    "attachment_pc_common.json": ATTACHMENT_PC_COMMON,
    "draft_agency_config.json": DRAFT_AGENCY_CONFIG,
    "draft_biz_config.json": "",
    "draft_virtual_store.json": "{}",
    "key_value.json": KEY_VALUE,
    "performance_opt_info.json": PERFORMANCE_OPT_INFO,
    "timeline_layout.json": JSON.stringify({
      dockItems: [
        {
          dockIndex: 0,
          ratio: 1,
          timelineIds: [contentId],
          timelineNames: [contentId],
        },
      ],
      layoutOrientation: 1,
    }),
    "draft_settings": `[General]\ndraft_create_time=${nowSec}\ndraft_last_edit_time=${nowSec}\nreal_edit_seconds=0\nreal_edit_keys=0\n`,
    "draft_cover.jpg": new Blob([base64ToUint8Array(MINIMAL_JPEG_BASE64)], { type: "image/jpeg" }),
  }

  for (const [fileName, blob] of Object.entries(mediaBlobs)) {
    files[`Resources/${fileName}`] = blob
  }

  return {
    folderName,
    draftId,
    contentId,
    placeholderId,
    foldPath,
    files,
  }
}

export function buildRootMetaInfoJson(
  store: Array<Record<string, unknown>>,
  newEntry: Record<string, unknown>
): string {
  return JSON.stringify({ all_draft_store: upsertRootMetaStore(store, newEntry) })
}
