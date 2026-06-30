import { supabase } from './supabase'
import type { Structure } from '../types'

// Helpers to map between client camelCase and DB snake_case column names
function toDbShape(payload: Partial<Structure>): Record<string, any> {
  const p: Record<string, any> = { ...payload }
  if (p.zIndex !== undefined) {
    p.z_index = p.zIndex
    delete p.zIndex
  }
  if (p.allowPlantOverlap !== undefined) {
    p.allow_plant_overlap = p.allowPlantOverlap
    delete p.allowPlantOverlap
  }
  if (p.growUpSides !== undefined) {
    p.grow_up_sides = p.growUpSides
    delete p.growUpSides
  }
  return p
}

function fromDbShape(row: Record<string, any>): Structure {
  if (!row) return row as any
  const r: Record<string, any> = { ...row }
  if (r.z_index !== undefined) {
    r.zIndex = r.z_index
    delete r.z_index
  }
  if (r.allow_plant_overlap !== undefined) {
    r.allowPlantOverlap = r.allow_plant_overlap
    delete r.allow_plant_overlap
  }
  if (r.grow_up_sides !== undefined) {
    r.growUpSides = r.grow_up_sides
    delete r.grow_up_sides
  }
  return r as Structure
}

export async function fetchStructuresForYard(yard_id: string) {
  const { data, error } = await supabase
    .from('structures')
    .select('*')
    .eq('yard_id', yard_id)
    .order('z_index', { ascending: true })

  const mapped = (data as any[] | null)?.map(fromDbShape) ?? null
  return { data: mapped as Structure[] | null, error }
}

export async function createStructure(payload: Partial<Structure>) {
  const dbPayload = toDbShape(payload)
  const { data, error } = await supabase
    .from('structures')
    .insert([dbPayload])
    .select()

  const row = (data as any[] | null)?.[0] ?? null
  return { data: row ? fromDbShape(row) : null, error }
}

export async function updateStructure(id: string, updates: Partial<Structure>) {
  const dbUpdates = toDbShape(updates)
  const { data, error } = await supabase
    .from('structures')
    .update(dbUpdates)
    .eq('id', id)
    .select()

  const row = (data as any[] | null)?.[0] ?? null
  return { data: row ? fromDbShape(row) : null, error }
}

export async function deleteStructure(id: string) {
  const { data, error } = await supabase
    .from('structures')
    .delete()
    .eq('id', id)

  return { data, error }
}

// Basic realtime subscription helper. Returns the subscription object; caller should unsubscribe when done.
export function subscribeToStructures(yard_id: string, cb: (event: string, payload: any) => void) {
  // Use realtime channel with postgres_changes for stable browser runtime
  const channel = supabase
    .channel(`structures:${yard_id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'structures', filter: `yard_id=eq.${yard_id}` }, (payload: any) => {
      const ev = payload.eventType ?? payload.type ?? payload.action ?? null
      if (!ev) return
      try {
        if (ev === 'INSERT') cb('INSERT', fromDbShape(payload.new))
        else if (ev === 'UPDATE') cb('UPDATE', fromDbShape(payload.new))
        else if (ev === 'DELETE') cb('DELETE', fromDbShape(payload.old))
      } catch (err) {
        // fallback to raw payload
        if (ev === 'INSERT') cb('INSERT', payload.new)
        else if (ev === 'UPDATE') cb('UPDATE', payload.new)
        else if (ev === 'DELETE') cb('DELETE', payload.old)
      }
    })
    .subscribe()

  return channel
}

export default {
  fetchStructuresForYard,
  createStructure,
  updateStructure,
  deleteStructure,
  subscribeToStructures,
}
