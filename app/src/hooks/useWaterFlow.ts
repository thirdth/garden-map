import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export type WaterFlowDir = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'NONE' | 'POOLING'
export type WaterFlowMap = Map<string, WaterFlowDir>  // key: `${row}-${col}`

export function cellKey(row: number, col: number) {
  return `${row}-${col}`
}

export function useWaterFlow(yardId: string) {
  const [flowMap, setFlowMap] = useState<WaterFlowMap>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase
      .from('grid_cells')
      .select('row, col, water_flow_direction')
      .eq('yard_id', yardId)
      .not('water_flow_direction', 'is', null)
      .then(({ data }) => {
        const map: WaterFlowMap = new Map()
        for (const cell of data ?? []) {
          map.set(cellKey(cell.row, cell.col), cell.water_flow_direction as WaterFlowDir)
        }
        setFlowMap(map)
        setLoading(false)
      })
  }, [yardId])

  const pending = useRef<Map<string, { row: number; col: number; value: WaterFlowDir | null }>>(new Map())
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleFlush() {
    if (flushTimer.current) return
    flushTimer.current = setTimeout(async () => {
      flushTimer.current = null
      const batch = [...pending.current.values()]
      pending.current.clear()
      for (const { row, col, value } of batch) {
        await supabase
          .from('grid_cells')
          .update({ water_flow_direction: value })
          .eq('yard_id', yardId)
          .eq('row', row)
          .eq('col', col)
      }
    }, 300)
  }

  function paintCell(row: number, col: number, value: WaterFlowDir | null) {
    const key = cellKey(row, col)
    setFlowMap(prev => {
      const next = new Map(prev)
      if (value === null) next.delete(key)
      else next.set(key, value)
      return next
    })
    pending.current.set(key, { row, col, value })
    scheduleFlush()
  }

  return { flowMap, loading, paintCell }
}
