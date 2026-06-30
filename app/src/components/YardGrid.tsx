import { useRef, useState, useEffect } from 'react'
import type { Structure, RectangleGeometry } from '../types'
import { fetchStructuresForYard, createStructure, subscribeToStructures, updateStructure, deleteStructure } from '../lib/structures'
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
  structureMode?: boolean
  shapeType?: 'rectangle' | 'polygon' | 'polyline' | 'point'
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
  yard, structureMode = false, shapeType = 'rectangle', showElevation, elevations, paintElevation,
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
  // Structures
  const [structures, setStructures] = useState<Structure[]>([])
  const [isDrawingStructure, setIsDrawingStructure] = useState(false)
  const drawStart = useRef<{ row: number; col: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ row: number; col: number } | null>(null)
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false)
  const [polygonPoints, setPolygonPoints] = useState<{ row: number; col: number }[] | null>(null)
  const [draggingVertex, setDraggingVertex] = useState<{ structureId: string; pointIndex: number } | null>(null)
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null)
  const [isDraggingStructure, setIsDraggingStructure] = useState(false)
  const dragOrigin = useRef<{ row: number; col: number } | null>(null)
  const origAnchor = useRef<{ row: number; col: number } | null>(null)

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

  // point-in-polygon ray-casting, x,y are in same coordinate space as points (here cell centers)
  function pointInPolygon(x: number, y: number, points: { x: number; y: number }[]) {
    let inside = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y
      const xj = points[j].x, yj = points[j].y
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  function handleMouseDown(e: React.MouseEvent) {
    const cell = getCellFromEvent(e)
    // Structure drawing mode takes precedence
    if (structureMode) {
      if (!cell) return
      const shape = shapeType ?? 'rectangle'
      if (shape === 'rectangle') {
        setIsDrawingStructure(true)
        drawStart.current = cell
        setDrawCurrent(cell)
        return
      }
      if (shape === 'point') {
        const geom: any = { shape: 'point', point: { row: cell.row, col: cell.col } }
        createStructure({ yard_id: yard.id, type: 'other', name: 'Point', geometry: geom }).then(({ data, error }) => {
          if (error) console.error('createStructure error', error)
          else if (data) setStructures(s => [...s, data])
        })
        return
      }
      // polygon or polyline
      if (!isDrawingPolygon) {
        setIsDrawingPolygon(true)
        setPolygonPoints([{ row: cell.row, col: cell.col }])
        return
      }
      // append point
      if (isDrawingPolygon && polygonPoints) {
        // double-click finishes
        if (e.detail === 2) {
          const pts = [...polygonPoints, { row: cell.row, col: cell.col }]
          const geom: any = { shape: shape === 'polygon' ? 'polygon' : 'polyline', points: pts }
          createStructure({ yard_id: yard.id, type: 'other', name: 'Shape', geometry: geom }).then(({ data, error }) => {
            if (error) console.error('createStructure error', error)
            else if (data) setStructures(s => [...s, data])
          })
          setIsDrawingPolygon(false)
          setPolygonPoints(null)
        } else {
          setPolygonPoints(p => p ? [...p, { row: cell.row, col: cell.col }] : [{ row: cell.row, col: cell.col }])
        }
      }
      return
    }
    // Hit-test structures: select and start drag
    if (cell) {
      const hit = structures.find(s => {
        const g: any = s.geometry
        if (g.shape === 'rectangle') {
          const top = g.anchor.row
          const left = g.anchor.col
          const bottom = top + g.height - 1
          const right = left + g.width - 1
          return cell.row >= top && cell.row <= bottom && cell.col >= left && cell.col <= right
        }
        // polygon hit-test: point-in-polygon
        if (g.shape === 'polygon') {
          const pts = g.points as {row:number;col:number}[]
          if (pointInPolygon(cell.col + 0.5, cell.row + 0.5, pts.map(p=>({x:p.col+0.5,y:p.row+0.5})))) return true
        }
        // polyline: hit if click on a vertex
        if (g.shape === 'polyline') {
          const pts = g.points as {row:number;col:number}[]
          if (pts.some(p => p.row === cell.row && p.col === cell.col)) return true
        }
        return false
      })
      if (hit) {
        setSelectedStructureId(hit.id)
        setIsDraggingStructure(true)
        dragOrigin.current = cell
        const g: any = hit.geometry
        origAnchor.current = { row: g.anchor.row, col: g.anchor.col }
        return
      } else {
        setSelectedStructureId(null)
      }
    }
    if (placingPlant) {
      if (cell) onPlantCell(cell.row, cell.col)
      return
    }
    // Click an existing planting to select it
    if (!paintOverlay && showPlants) {
      if (cell) {
        const hit = plantings.find(p => p.anchor_row === cell.row && p.anchor_col === cell.col)
        if (hit) { onPlantingClick(hit); return }
      }
    }
    if (!paintOverlay) return
    e.preventDefault()
    setIsPainting(true)
    lastPainted.current = null
    if (cell) {
      lastPainted.current = cellKey(cell.row, cell.col)
      onPaintCell(cell.row, cell.col)
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    const cell = getCellFromEvent(e)
    // Structure drawing preview
    if (structureMode && isDrawingStructure) {
      if (!cell) return
      setDrawCurrent(cell)
      return
    }
    // dragging vertex
    if (draggingVertex) {
      if (!cell) return
      setStructures(prev => prev.map(s => {
        if (s.id !== draggingVertex.structureId) return s
        const g: any = s.geometry
        if (g.shape === 'polygon' || g.shape === 'polyline') {
          const pts = g.points.map((p:any,i:number)=> i===draggingVertex.pointIndex ? { row: cell.row, col: cell.col } : p)
          return { ...s, geometry: { ...g, points: pts } }
        }
        return s
      }))
      return
    }
    // dragging structure
    if (isDraggingStructure) {
      if (!cell || !dragOrigin.current || !origAnchor.current) return
      const dr = cell.row - dragOrigin.current.row
      const dc = cell.col - dragOrigin.current.col
      setStructures(prev => prev.map(s => {
        if (s.id !== selectedStructureId) return s
        const g: any = s.geometry
        if (g.shape === 'rectangle') {
          const newGeom = { ...g, anchor: { row: origAnchor.current!.row + dr, col: origAnchor.current!.col + dc } }
          return { ...s, geometry: newGeom }
        }
        return s
      }))
      return
    }
    if (!isPainting || !paintOverlay) return
    if (!cell) return
    const key = cellKey(cell.row, cell.col)
    if (key === lastPainted.current) return
    lastPainted.current = key
    onPaintCell(cell.row, cell.col)
  }

  function handleMouseUp() {
    // Structure drawing finish
    if (structureMode && isDrawingStructure) {
      setIsDrawingStructure(false)
      const start = drawStart.current
      const end = drawCurrent
      drawStart.current = null
      setDrawCurrent(null)
      if (start && end) {
      const top = Math.min(start.row, end.row)
      const left = Math.min(start.col, end.col)
      const height = Math.abs(end.row - start.row) + 1
      const width = Math.abs(end.col - start.col) + 1
      // create a rectangle structure
      const geom: RectangleGeometry = { shape: 'rectangle', anchor: { row: top, col: left }, width, height }
        createStructure({ yard_id: yard.id, type: 'patio', name: 'New structure', geometry: geom, allowPlantOverlap: 'full' })
          .then(({ data, error }) => {
            if (error) console.error('createStructure error', error)
            else if (data) setStructures(s => [...s, data])
          })
      }
      return
    }
    // finish dragging vertex
    if (draggingVertex) {
      const dv = draggingVertex
      setDraggingVertex(null)
      const s = structures.find(s => s.id === dv.structureId)
      if (s) updateStructure(s.id, { geometry: s.geometry }).then(({ error }) => { if (error) console.error('updateStructure error', error) })
      return
    }
    // finish dragging structure
    if (isDraggingStructure && selectedStructureId) {
      setIsDraggingStructure(false)
      dragOrigin.current = null
      const s = structures.find(s => s.id === selectedStructureId)
      if (s) {
        updateStructure(s.id, { geometry: s.geometry }).then(({ error }) => { if (error) console.error('updateStructure error', error) })
      }
      return
    }
    setIsPainting(false)
    lastPainted.current = null
  }

  // Load structures and subscribe
  useEffect(() => {
    let mounted = true
    fetchStructuresForYard(yard.id).then(({ data }) => { if (mounted && data) setStructures(data) })
    const sub = subscribeToStructures(yard.id, (_event, payload) => {
      const ev = _event
      if (ev === 'INSERT') setStructures(s => [...s, payload])
      if (ev === 'UPDATE') setStructures(s => s.map(x => x.id === payload.id ? payload : x))
      if (ev === 'DELETE') setStructures(s => s.filter(x => x.id !== payload.id))
    })
    return () => { mounted = false; if (sub && (sub as any).unsubscribe) (sub as any).unsubscribe() }
  }, [yard.id])

  // keyboard delete listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedStructureId) {
        deleteStructure(selectedStructureId).then(({ error }) => {
          if (error) console.error('deleteStructure error', error)
          else setStructures(s => s.filter(x => x.id !== selectedStructureId))
        })
        setSelectedStructureId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedStructureId])

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
            {/* Layer 2.5: Structures */}
              {structures.map(s => {
                const geom: any = s.geometry
                const isSelected = selectedStructureId === s.id
                const fill = s.color ?? '#e9e9ff'
                if (geom.shape === 'rectangle') {
                  const x = geom.anchor.col * CELL_PX
                  const y = geom.anchor.row * CELL_PX
                  const w = geom.width * CELL_PX
                  const h = geom.height * CELL_PX
                  return (
                    <g key={s.id} style={{ pointerEvents: 'none' }}>
                      <rect x={x} y={y} width={w} height={h} fill={fill} opacity={0.6}
                        stroke={isSelected ? '#4c1d95' : '#6366f1'} strokeWidth={isSelected ? 2 : 1} />
                    </g>
                  )
                }
                if (geom.shape === 'polygon' || geom.shape === 'polyline') {
                  const pts = (geom.points as {row:number;col:number}[])
                  const pointsAttr = pts.map(p => `${p.col * CELL_PX + CELL_PX/2},${p.row * CELL_PX + CELL_PX/2}`).join(' ')
                  return (
                    <g key={s.id}>
                      {geom.shape === 'polygon' ? (
                        <polygon points={pointsAttr} fill={fill} opacity={0.5}
                          stroke={isSelected ? '#4c1d95' : '#6366f1'} strokeWidth={isSelected ? 2 : 1} />
                      ) : (
                        <polyline points={pointsAttr} fill="none" opacity={0.9}
                          stroke={isSelected ? '#4c1d95' : '#6366f1'} strokeWidth={isSelected ? 2 : 1} />
                      )}
                      {isSelected && pts.map((p, idx) => (
                        <circle key={idx} cx={p.col * CELL_PX + CELL_PX/2} cy={p.row * CELL_PX + CELL_PX/2}
                          r={4} fill="#fff" stroke="#4c1d95" strokeWidth={1}
                          style={{ cursor: 'move' }}
                          onMouseDown={(ev: any) => { ev.stopPropagation(); setDraggingVertex({ structureId: s.id, pointIndex: idx }) }} />
                      ))}
                    </g>
                  )
                }
                if (geom.shape === 'point') {
                  const x = geom.point.col * CELL_PX + CELL_PX/2
                  const y = geom.point.row * CELL_PX + CELL_PX/2
                  return <circle key={s.id} cx={x} cy={y} r={6} fill={fill} opacity={0.9} stroke={isSelected ? '#4c1d95' : '#6366f1'} strokeWidth={isSelected ? 2 : 1} />
                }
                return null
              })}

            {/* Drawing preview */}
              {isDrawingStructure && drawStart.current && drawCurrent && (() => {
                const top = Math.min(drawStart.current.row, drawCurrent.row)
                const left = Math.min(drawStart.current.col, drawCurrent.col)
                const w = (Math.abs(drawCurrent.col - drawStart.current.col) + 1) * CELL_PX
                const h = (Math.abs(drawCurrent.row - drawStart.current.row) + 1) * CELL_PX
                return <rect x={left * CELL_PX} y={top * CELL_PX} width={w} height={h}
                  fill="#a78bfa" opacity={0.35} stroke="#7c3aed" strokeDasharray="4 2" />
              })()}

              {/* Polygon/polyline drawing preview */}
              {isDrawingPolygon && polygonPoints && (
                <g>
                  <polyline points={polygonPoints.map(p => `${p.col * CELL_PX + CELL_PX/2},${p.row * CELL_PX + CELL_PX/2}`).join(' ')}
                    fill="none" stroke="#7c3aed" strokeWidth={1.5} strokeDasharray="4 2" />
                  {polygonPoints.map((p, i) => (
                    <circle key={i} cx={p.col * CELL_PX + CELL_PX/2} cy={p.row * CELL_PX + CELL_PX/2} r={3} fill="#7c3aed" />
                  ))}
                </g>
              )}
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
