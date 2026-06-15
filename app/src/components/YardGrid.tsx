import { useRef, useState } from 'react'
import { Yard, ShadeMap, ShadeValue, Planting } from '../types'
import { ElevationMap, cellKey } from '../hooks/useElevation'
import { WaterFlowMap, WaterFlowDir } from '../hooks/useWaterFlow'
import { elevationColor } from '../lib/elevationColor'
import { SHADE_CONFIG, shadePatternId } from '../lib/shadePatterns'
import { getPlantIcon, getPlantColors } from '../lib/plantIcons'
import { plantState, plantStateColor } from '../lib/plantSeasons'

const CELL_PX = 18

const FLOW_ARROW: Record<WaterFlowDir, string> = {
  N: '↑', NE: '↗', E: '→', SE: '↘',
  S: '↓', SW: '↙', W: '←', NW: '↖',
  NONE: '—', POOLING: '◉',
}

type PaintOverlay = 'elevation' | 'waterflow' | 'shade' | null

interface Props {
  yard: Yard
  showElevation: boolean
  elevations: ElevationMap
  paintElevation: number | null
  showWaterFlow: boolean
  flowMap: WaterFlowMap
  paintFlow: WaterFlowDir | null
  showShade: boolean
  shadeMap: ShadeMap
  paintShade: ShadeValue | null
  paintOverlay: PaintOverlay
  onPaintCell: (row: number, col: number) => void
  showPlants: boolean
  plantings: Planting[]
  selectedPlanting: Planting | null
  placingPlant: boolean
  onPlantCell: (row: number, col: number) => void
  onPlantingClick: (planting: Planting) => void
  currentMonth: number
}

const ALL_SHADE_VALUES = Object.keys(SHADE_CONFIG) as ShadeValue[]

function ShadePatternDefs({ yardId }: { yardId: string }) {
  return (
    <>
      {ALL_SHADE_VALUES.map(value => {
        const cfg = SHADE_CONFIG[value]
        const id = shadePatternId(value, yardId)
        if (cfg.type === 'solid') return null
        const s = cfg.spacing
        return (
          <pattern key={id} id={id} width={s} height={s}
            patternUnits="userSpaceOnUse" patternTransform={`rotate(${cfg.angle})`}>
            <line x1={s / 2} y1={0} x2={s / 2} y2={s}
              stroke={cfg.stroke} strokeWidth={cfg.strokeWidth} />
            {cfg.type === 'crosshatch' && (
              <line x1={0} y1={s / 2} x2={s} y2={s / 2}
                stroke={cfg.stroke} strokeWidth={cfg.strokeWidth} />
            )}
          </pattern>
        )
      })}
    </>
  )
}

function footprintRadius(spreadMaxFt: number | null, cellSizeIn: number): number {
  if (!spreadMaxFt || spreadMaxFt <= 0) return 0
  // spread is a diameter in feet → radius in cells → radius in px
  return (spreadMaxFt * 12 / cellSizeIn / 2) * CELL_PX
}

export function YardGrid({
  yard, showElevation, elevations, paintElevation,
  showWaterFlow, flowMap, paintFlow,
  showShade, shadeMap, paintShade,
  paintOverlay, onPaintCell,
  showPlants, plantings, selectedPlanting, placingPlant, onPlantCell, onPlantingClick,
  currentMonth,
}: Props) {
  const { width_cells: cols, height_cells: rows, cell_size_inches: cellIn } = yard
  const totalW = cols * CELL_PX
  const totalH = rows * CELL_PX
  const svgRef = useRef<SVGSVGElement>(null)
  const [isPainting, setIsPainting] = useState(false)
  const lastPainted = useRef<string | null>(null)

  const ftCells = 12 / cellIn
  const colLabels: number[] = []
  const rowLabels: number[] = []
  for (let c = 0; c <= cols; c += ftCells) colLabels.push(c)
  for (let r = 0; r <= rows; r += ftCells) rowLabels.push(r)

  function getCellFromEvent(e: React.MouseEvent): { row: number; col: number } | null {
    if (!svgRef.current) return null
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - 40
    const y = e.clientY - rect.top - 20
    const col = Math.floor(x / CELL_PX)
    const row = Math.floor(y / CELL_PX)
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null
    return { row, col }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (placingPlant) {
      const cell = getCellFromEvent(e)
      if (cell) onPlantCell(cell.row, cell.col)
      return
    }
    // Click an existing planting to select it
    if (!paintOverlay && showPlants) {
      const cell = getCellFromEvent(e)
      if (cell) {
        const hit = plantings.find(p => p.anchor_row === cell.row && p.anchor_col === cell.col)
        if (hit) { onPlantingClick(hit); return }
      }
    }
    if (!paintOverlay) return
    e.preventDefault()
    setIsPainting(true)
    lastPainted.current = null
    const cell = getCellFromEvent(e)
    if (cell) {
      lastPainted.current = cellKey(cell.row, cell.col)
      onPaintCell(cell.row, cell.col)
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isPainting || !paintOverlay) return
    const cell = getCellFromEvent(e)
    if (!cell) return
    const key = cellKey(cell.row, cell.col)
    if (key === lastPainted.current) return
    lastPainted.current = key
    onPaintCell(cell.row, cell.col)
  }

  function handleMouseUp() {
    setIsPainting(false)
    lastPainted.current = null
  }

  const activePaintValue = paintOverlay === 'elevation' ? paintElevation
    : paintOverlay === 'waterflow' ? paintFlow
    : paintOverlay === 'shade' ? paintShade : null
  const canPaint = paintOverlay !== null && activePaintValue !== null
  const isErasing = paintOverlay !== null && activePaintValue === null
  const cursor = placingPlant ? 'copy' : canPaint ? 'crosshair' : isErasing ? 'cell' : 'default'

  return (
    <div className="overflow-auto flex-1 p-4">
      <svg
        ref={svgRef}
        width={totalW + 40}
        height={totalH + 40}
        className="block select-none"
        style={{ fontFamily: 'inherit', cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {colLabels.map(c => (
          <text key={c} x={40 + c * CELL_PX} y={14} textAnchor="middle" fontSize={9} fill="#9ca3af">
            {c / ftCells}′
          </text>
        ))}
        {rowLabels.map(r => (
          <text key={r} x={32} y={40 + r * CELL_PX + 3} textAnchor="end" fontSize={9} fill="#9ca3af">
            {r / ftCells}′
          </text>
        ))}

        <g transform="translate(40,20)">
          <rect width={totalW} height={totalH} fill="#f9fafb" />

          <defs>
            <pattern id={`grid-${yard.id}`} width={CELL_PX} height={CELL_PX} patternUnits="userSpaceOnUse">
              <path d={`M ${CELL_PX} 0 L 0 0 0 ${CELL_PX}`} fill="none" stroke="#e5e7eb" strokeWidth={0.5} />
            </pattern>
            <ShadePatternDefs yardId={yard.id} />
          </defs>

          <rect width={totalW} height={totalH} fill={`url(#grid-${yard.id})`} />

          {/* Layer 1: Elevation */}
          {showElevation && Array.from(elevations.entries()).map(([key, val]) => {
            const [r, c] = key.split('-').map(Number)
            return <rect key={key} x={c * CELL_PX} y={r * CELL_PX}
              width={CELL_PX} height={CELL_PX} fill={elevationColor(val)} stroke="none" />
          })}

          {/* Layer 2: Shade */}
          {showShade && Array.from(shadeMap.entries()).map(([key, val]) => {
            const [r, c] = key.split('-').map(Number)
            const cfg = SHADE_CONFIG[val]
            const x = c * CELL_PX, y = r * CELL_PX
            if (cfg.type === 'solid') {
              return <rect key={key} x={x} y={y} width={CELL_PX} height={CELL_PX}
                fill={cfg.fill} opacity={cfg.opacity} stroke="none" />
            }
            return <rect key={key} x={x} y={y} width={CELL_PX} height={CELL_PX}
              fill={`url(#${shadePatternId(val, yard.id)})`} opacity={cfg.opacity} stroke="none" />
          })}

          {/* Layer 3a: Plant footprint circles */}
          {showPlants && plantings.map(p => {
            const r = footprintRadius(p.spread_max_ft, cellIn)
            if (r < CELL_PX / 2) return null
            const colors = getPlantColors(p.taxonomic_type)
            const state = plantState(p, currentMonth)
            const fg = plantStateColor(p, state, colors.fg)
            const cx = p.anchor_col * CELL_PX + CELL_PX / 2
            const cy = p.anchor_row * CELL_PX + CELL_PX / 2
            const isSelected = selectedPlanting?.id === p.id
            return (
              <circle key={`fp-${p.id}`} cx={cx} cy={cy} r={r}
                fill={fg} opacity={state === 'dormant' ? 0.1 : 0.2}
                stroke={fg}
                strokeWidth={isSelected ? 1.5 : 0.75}
                strokeDasharray={isSelected ? '3 2' : undefined}
                style={{ pointerEvents: 'none' }} />
            )
          })}

          {/* Layer 3b: Plant icons */}
          {showPlants && plantings.map(p => {
            const Icon = getPlantIcon(p.taxonomic_type)
            const colors = getPlantColors(p.taxonomic_type)
            const state = plantState(p, currentMonth)
            const fg = plantStateColor(p, state, colors.fg)
            const x = p.anchor_col * CELL_PX
            const y = p.anchor_row * CELL_PX
            const isSelected = selectedPlanting?.id === p.id
            const opacity = state === 'dormant' ? 0.4 : 1
            return (
              <foreignObject key={p.id} x={x} y={y} width={CELL_PX} height={CELL_PX}
                style={{ pointerEvents: 'none', opacity }}>
                <div style={{
                  width: CELL_PX, height: CELL_PX,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: colors.bg,
                  borderRadius: '50%',
                  border: `${isSelected ? 2 : 1}px solid ${fg}`,
                  boxSizing: 'border-box',
                  boxShadow: isSelected ? `0 0 0 2px white, 0 0 0 3.5px ${fg}` : undefined,
                }}>
                  <Icon size={11} color={fg} />
                </div>
              </foreignObject>
            )
          })}

          {/* Layer 4: Water flow arrows */}
          {showWaterFlow && Array.from(flowMap.entries()).map(([key, dir]) => {
            const [r, c] = key.split('-').map(Number)
            return <text key={key}
              x={c * CELL_PX + CELL_PX / 2} y={r * CELL_PX + CELL_PX / 2 + 4}
              textAnchor="middle" fontSize={10} fill="#2563eb"
              style={{ pointerEvents: 'none' }}>
              {FLOW_ARROW[dir]}
            </text>
          })}

          {/* Foot gridlines */}
          {colLabels.map(c => (
            <line key={c} x1={c * CELL_PX} y1={0} x2={c * CELL_PX} y2={totalH}
              stroke="#d1d5db" strokeWidth={c === 0 || c === cols ? 1 : 0.5} />
          ))}
          {rowLabels.map(r => (
            <line key={r} x1={0} y1={r * CELL_PX} x2={totalW} y2={r * CELL_PX}
              stroke="#d1d5db" strokeWidth={r === 0 || r === rows ? 1 : 0.5} />
          ))}

          <rect width={totalW} height={totalH} fill="none" stroke="#9ca3af" strokeWidth={1} />
        </g>
      </svg>
    </div>
  )
}
