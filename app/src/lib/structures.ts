import { supabase } from './supabase'
import type { Structure } from '../types'

export async function fetchStructuresForYard(yard_id: string) {
  const { data, error } = await supabase
    .from('structures')
    .select('*')
    .eq('yard_id', yard_id)
    .order('z_index', { ascending: true })

  return { data: data as Structure[] | null, error }
}

export async function createStructure(payload: Partial<Structure>) {
  const { data, error } = await supabase
    .from('structures')
    .insert([payload])
    .select()

  return { data: (data as Structure[] | null)?.[0] ?? null, error }
}

export async function updateStructure(id: string, updates: Partial<Structure>) {
  const { data, error } = await supabase
    .from('structures')
    .update(updates)
    .eq('id', id)
    .select()

  return { data: (data as Structure[] | null)?.[0] ?? null, error }
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
      if (ev === 'INSERT') cb('INSERT', payload.new)
      else if (ev === 'UPDATE') cb('UPDATE', payload.new)
      else if (ev === 'DELETE') cb('DELETE', payload.old)
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
