import type { Structure } from '../types'

const CELL_PX = 18

interface Props {
  structures: Structure[]
  selectedStructureId: string | null
  onVertexMouseDown: (structureId: string, pointIndex: number) => void
}

export function StructureLayer({ structures, selectedStructureId, onVertexMouseDown }: Props) {
  return (
    <>
      {structures.map(structure => {
        const geom: any = structure.geometry
        const isSelected = selectedStructureId === structure.id
        const fill = structure.color ?? '#e9e9ff'

        if (geom.shape === 'rectangle') {
          const x = geom.anchor.col * CELL_PX
          const y = geom.anchor.row * CELL_PX
          const w = geom.width * CELL_PX
          const h = geom.height * CELL_PX
          return (
            <g key={structure.id} style={{ pointerEvents: 'none' }}>
              <rect x={x} y={y} width={w} height={h} fill={fill} opacity={0.6}
                stroke={isSelected ? '#4c1d95' : '#6366f1'} strokeWidth={isSelected ? 2 : 1} />
            </g>
          )
        }

        if (geom.shape === 'polygon' || geom.shape === 'polyline') {
          const pts = geom.points as { row: number; col: number }[]
          const pointsAttr = pts.map(p => `${p.col * CELL_PX + CELL_PX / 2},${p.row * CELL_PX + CELL_PX / 2}`).join(' ')
          return (
            <g key={structure.id}>
              {geom.shape === 'polygon' ? (
                <polygon points={pointsAttr} fill={fill} opacity={0.5}
                  stroke={isSelected ? '#4c1d95' : '#6366f1'} strokeWidth={isSelected ? 2 : 1}
                  style={{ pointerEvents: 'none' }} />
              ) : (
                <polyline points={pointsAttr} fill="none" opacity={0.9}
                  stroke={isSelected ? '#4c1d95' : '#6366f1'} strokeWidth={isSelected ? 2 : 1}
                  style={{ pointerEvents: 'none' }} />
              )}
              {isSelected && pts.map((p, idx) => (
                <circle key={idx} cx={p.col * CELL_PX + CELL_PX / 2} cy={p.row * CELL_PX + CELL_PX / 2}
                  r={4} fill="#fff" stroke="#4c1d95" strokeWidth={1}
                  style={{ cursor: 'move', pointerEvents: 'all' }}
                  onMouseDown={ev => { ev.stopPropagation(); onVertexMouseDown(structure.id, idx) }} />
              ))}
            </g>
          )
        }

        if (geom.shape === 'point') {
          const x = geom.point.col * CELL_PX + CELL_PX / 2
          const y = geom.point.row * CELL_PX + CELL_PX / 2
          return (
            <circle key={structure.id} cx={x} cy={y} r={6} fill={fill} opacity={0.9}
              stroke={isSelected ? '#4c1d95' : '#6366f1'} strokeWidth={isSelected ? 2 : 1} style={{ pointerEvents: 'none' }} />
          )
        }

        return null
      })}
    </>
  )
}
