import { Dot, Eye, EyeOff, ImageIcon, Layers, Shapes, Square, Type } from 'lucide-react'
import type { ReactNode } from 'react'
import { buildStudioLayerList } from '@/lib/longform-v2/thumbnailTemplateStudio/layerList'
import { isStudioLayerRefSelected } from '@/lib/longform-v2/thumbnailTemplateStudio/layerSelection'
import type { StudioLayerRef, ThumbnailStudioDocument } from '@/lib/longform-v2/thumbnailTemplateStudio/types'

type Props = {
  doc: ThumbnailStudioDocument
  selectedLayers: StudioLayerRef[]
  onSelectLayer: (ref: StudioLayerRef, modifiers?: { ctrl?: boolean; shift?: boolean }) => void
  onToggleLayerVisible: (ref: StudioLayerRef, visible: boolean) => void
}

export function StudioLayerPanel({
  doc,
  selectedLayers,
  onSelectLayer,
  onToggleLayerVisible,
}: Props) {
  const layers = buildStudioLayerList(doc)

  function isSelected(ref: StudioLayerRef): boolean {
    return isStudioLayerRefSelected(selectedLayers, ref)
  }

  if (layers.length === 0) {
    return <p className="thumb-ui-hint">표시할 레이어가 없습니다.</p>
  }

  return (
    <ul className="thumb-layer-panel" aria-label="레이어 목록">
      {layers.map((layer) => (
        <li key={`${layer.ref.kind}-${'id' in layer.ref ? layer.ref.id : 'bg'}`} className="thumb-layer-panel__item">
          <button
            type="button"
            className={
              'thumb-layer-panel__row' + (isSelected(layer.ref) ? ' thumb-layer-panel__row--on' : '')
            }
            onClick={(e) =>
              onSelectLayer(layer.ref, {
                ctrl: e.ctrlKey || e.metaKey,
                shift: e.shiftKey,
              })
            }
          >
            <span className="thumb-layer-panel__kind">{layerKindIcon(layer.ref.kind)}</span>
            <span className="thumb-layer-panel__label">{layer.label}</span>
            <span className="thumb-layer-panel__z">z{layer.zIndex}</span>
          </button>
          {layer.canToggleVisible ? (
            <button
              type="button"
              className={
                'thumb-layer-panel__eye' + (layer.visible ? '' : ' thumb-layer-panel__eye--off')
              }
              title={layer.visible ? '숨기기' : '표시'}
              aria-label={layer.visible ? '레이어 숨기기' : '레이어 표시'}
              onClick={(e) => {
                e.stopPropagation()
                onToggleLayerVisible(layer.ref, !layer.visible)
              }}
            >
              {layer.visible ? <Eye className="lfv2-ico" aria-hidden /> : <EyeOff className="lfv2-ico" aria-hidden />}
            </button>
          ) : (
            <span className="thumb-layer-panel__eye thumb-layer-panel__eye--fixed" aria-hidden />
          )}
        </li>
      ))}
    </ul>
  )
}

function layerKindIcon(kind: StudioLayerRef['kind']): ReactNode {
  switch (kind) {
    case 'background':
      return <Square className="lfv2-ico" aria-hidden />
    case 'text':
      return <Type className="lfv2-ico" aria-hidden />
    case 'image':
      return <ImageIcon className="lfv2-ico" aria-hidden />
    case 'shape':
      return <Shapes className="lfv2-ico" aria-hidden />
    case 'overlay':
      return <Layers className="lfv2-ico" aria-hidden />
    default:
      return <Dot className="lfv2-ico" aria-hidden />
  }
}
