import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ShadeMap, ShadeValue } from '../types'

export type { ShadeMap, ShadeValue }

export function cellKey(row: number, col: number) {
  return `${row}-${col}`
}

export function useShade(yardId: string) {
  const [shadeMap, setShadeMap] = useState<ShadeMap>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase
      .from('grid_cells')
      .select('row, col, shade_level')
      .eq('yard_id', yardId)
      .not('shade_level', 'is', null)
      .then(({ data }) => {
        const map: ShadeMap = new Map()
        for (const cell of data ?? []) {
          map.set(cellKey(cell.row, cell.col), cell.shade_level as ShadeValue)
        }
        setShadeMap(map)
        setLoading(false)
      })
  }, [yardId])

  const pending = useRef<Map<string, { row: number; col: number; value: ShadeValue | null }>>(new Map())
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
          .update({ shade_level: value })
          .eq('yard_id', yardId)
          .eq('row', row)
          .eq('col', col)
      }
    }, 300)
  }

  function paintCell(row: number, col: number, value: ShadeValue | null) {
    const key = cellKey(row, col)
    setShadeMap(prev => {
      const next = new Map(prev)
      if (value === null) next.delete(key)
      else next.set(key, value)
      return next
    })
    pending.current.set(key, { row, col, value })
    scheduleFlush()
  }

  return { shadeMap, loading, paintCell }
}
