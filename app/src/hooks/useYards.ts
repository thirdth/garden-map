import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Yard } from '../types'

export function useYards() {
  const [yards, setYards] = useState<Yard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('yards')
      .select('*')
      .order('name')
      .then(({ data }) => {
        setYards(data ?? [])
        setLoading(false)
      })
  }, [])

  async function createYard(
    name: string,
    widthFt: number,
    heightFt: number,
    cellSizeInches: number
  ): Promise<Yard> {
    const widthCells = Math.round((widthFt * 12) / cellSizeInches)
    const heightCells = Math.round((heightFt * 12) / cellSizeInches)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: yard, error } = await supabase
      .from('yards')
      .insert({ user_id: user.id, name, width_cells: widthCells, height_cells: heightCells, cell_size_inches: cellSizeInches })
      .select()
      .single()

    if (error) throw error

    // Pre-populate all grid cells for this yard
    const cells = []
    for (let row = 0; row < heightCells; row++) {
      for (let col = 0; col < widthCells; col++) {
        cells.push({ yard_id: yard.id, row, col })
      }
    }

    // Insert in batches of 500 to stay within Supabase limits
    for (let i = 0; i < cells.length; i += 500) {
      const { error: cellError } = await supabase
        .from('grid_cells')
        .insert(cells.slice(i, i + 500))
      if (cellError) throw cellError
    }

    setYards(prev => [...prev, yard].sort((a, b) => a.name.localeCompare(b.name)))
    return yard
  }

  return { yards, loading, createYard }
}
