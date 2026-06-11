import { VOICE_PREVIEW_BGM_OPTIONS } from "@/lib/shotform-factory-voice-preview-bgm"
import {
  legacySfxToBgmCatalogId,
  MVP_EXTRA_BGM_OPTIONS,
} from "@/lib/shotform-mvp-sfx-catalog"

export type MvpAudioCatalogItem = {
  id: string
  label: string
  src: string
}

export const MVP_AUDIO_CATALOG: readonly MvpAudioCatalogItem[] = [
  ...VOICE_PREVIEW_BGM_OPTIONS.map((o) => ({
    id: `bgm-${o.id}`,
    label: o.label,
    src: o.src,
  })),
  ...MVP_EXTRA_BGM_OPTIONS.map((o) => ({
    id: `bgm-${o.id}`,
    label: o.label,
    src: o.src,
  })),
]

export function normalizeMvpAudioCatalogId(catalogId: string): string {
  return legacySfxToBgmCatalogId(catalogId) ?? catalogId
}

export function mvpAudioCatalogItem(catalogId: string): MvpAudioCatalogItem | null {
  const id = normalizeMvpAudioCatalogId(catalogId)
  return MVP_AUDIO_CATALOG.find((o) => o.id === id) ?? null
}
