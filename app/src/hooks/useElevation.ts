import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ElevationMap = Map<string, number>  // key: `${row}-${col}`

export function cellKey(row: number, col: number) {
  return `${row}-${col}`
}

export function useElevation(yardId: string) {
  const [elevations, setElevations] = useState<ElevationMap>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!yardId) { setLoading(false); return }
    setLoading(true)
    supabase
      .from('grid_cells')
      .select('row, col, elevation')
      .eq('yard_id', yardId)
      .not('elevation', 'is', null)
      .then(({ data }) => {
        const map: ElevationMap = new Map()
        for (const cell of data ?? []) {
          map.set(cellKey(cell.row, cell.col), cell.elevation)
        }
        setElevations(map)
        setLoading(false)
      })
  }, [yardId])

  // Pending writes: batch DB updates so rapid painting doesn't flood the API
  const pending = useRef<Map<string, { row: number; col: number; value: number | null }>>(new Map())
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
          .update({ elevation: value })
          .eq('yard_id', yardId)
          .eq('row', row)
          .eq('col', col)
      }
    }, 300)
  }

  function paintCell(row: number, col: number, value: number | null) {
    const key = cellKey(row, col)
    setElevations(prev => {
      const next = new Map(prev)
      if (value === null) next.delete(key)
      else next.set(key, value)
      return next
    })
    pending.current.set(key, { row, col, value })
    scheduleFlush()
  }

  return { elevations, loading, paintCell }
}
