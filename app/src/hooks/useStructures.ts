import { useEffect, useState } from 'react'
import type { Structure } from '../types'
import { fetchStructuresForYard, createStructure as createStructureRaw, updateStructure as updateStructureRaw, deleteStructure as deleteStructureRaw, subscribeToStructures } from '../lib/structures'

export function useStructures(yardId: string) {
  const [structures, setStructures] = useState<Structure[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!yardId) return
    let mounted = true
    setLoading(true)
    fetchStructuresForYard(yardId).then(({ data }) => {
      if (!mounted) return
      setStructures(data ?? [])
      setLoading(false)
    })
    const sub = subscribeToStructures(yardId, (event, payload) => {
      if (event === 'INSERT') setStructures(prev => [...prev, payload])
      if (event === 'UPDATE') setStructures(prev => prev.map(s => s.id === payload.id ? payload : s))
      if (event === 'DELETE') setStructures(prev => prev.filter(s => s.id !== payload.id))
    })
    return () => {
      mounted = false
      if (sub && (sub as any).unsubscribe) (sub as any).unsubscribe()
    }
  }, [yardId])

  async function createStructure(payload: Partial<Structure>) {
    const result = await createStructureRaw(payload)
    if (result.data) {
      setStructures(prev => [...prev, result.data as Structure])
    }
    return result
  }

  async function updateStructure(id: string, updates: Partial<Structure>) {
    const result = await updateStructureRaw(id, updates)
    if (result.data) {
      setStructures(prev => prev.map(s => s.id === id ? result.data as Structure : s))
    }
    return result
  }

  async function deleteStructure(id: string) {
    const result = await deleteStructureRaw(id)
    if (!result.error) setStructures(prev => prev.filter(s => s.id !== id))
    return result
  }

  return { structures, loading, createStructure, updateStructure, deleteStructure }
}
