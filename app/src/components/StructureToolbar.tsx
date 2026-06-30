import { MousePointerClick, Square, Triangle, Line, MapPin } from 'lucide-react'

const shapes = [
  { value: 'rectangle', label: 'Rectangle', icon: Square },
  { value: 'polygon', label: 'Polygon', icon: Triangle },
  { value: 'polyline', label: 'Polyline', icon: Line },
  { value: 'point', label: 'Point', icon: MapPin },
] as const

type ShapeType = 'rectangle' | 'polygon' | 'polyline' | 'point'

interface Props {
  enabled: boolean
  shapeType: ShapeType
  onToggle: () => void
  onShapeChange: (shape: ShapeType) => void
}

export function StructureToolbar({ enabled, shapeType, onToggle, onShapeChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${enabled ? 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-2 ring-indigo-300 ring-offset-1' : 'text-stone-500 border-stone-200 hover:bg-stone-50'}`}>
        <MousePointerClick size={14} /> Structure
      </button>
      {enabled && shapes.map(({ value, label, icon: Icon }) => (
        <button key={value} onClick={() => onShapeChange(value)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${shapeType === value ? 'bg-indigo-100 text-indigo-800' : 'text-stone-500 hover:bg-stone-50'}`}>
          <Icon size={12} /> {label}
        </button>
      ))}
    </div>
  )
}
