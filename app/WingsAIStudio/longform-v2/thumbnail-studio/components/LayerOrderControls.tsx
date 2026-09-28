import type { StudioLayerReorderOp } from '@/lib/longform-v2/thumbnailTemplateStudio/layerOrder'

type Props = {
  onReorder: (op: StudioLayerReorderOp) => void
}

const ACTIONS: { op: StudioLayerReorderOp; label: string; title: string }[] = [
  { op: 'front', label: '맨 앞', title: '맨 앞으로 — 다른 요소보다 위에' },
  { op: 'forward', label: '앞으로', title: '한 단계 앞으로' },
  { op: 'backward', label: '뒤로', title: '한 단계 뒤로' },
  { op: 'back', label: '맨 뒤', title: '맨 뒤로 — 다른 요소보다 아래' },
]

export function LayerOrderControls({ onReorder }: Props) {
  return (
    <div className="thumb-ui-layer-order" role="group" aria-label="레이어 순서">
      {ACTIONS.map(({ op, label, title }) => (
        <button
          key={op}
          type="button"
          className="thumb-ui-layer-order__btn"
          title={title}
          onClick={() => onReorder(op)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
