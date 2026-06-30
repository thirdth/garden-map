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
  // supabase-js types for realtime subscription are a bit strict; cast to any to avoid build errors
  const anySupabase: any = supabase
  const sub = anySupabase
    .from(`structures:yard_id=eq.${yard_id}`)
    .on('INSERT', (payload: any) => cb('INSERT', payload.new))
    .on('UPDATE', (payload: any) => cb('UPDATE', payload.new))
    .on('DELETE', (payload: any) => cb('DELETE', payload.old))
    .subscribe()

  return sub
}

export default {
  fetchStructuresForYard,
  createStructure,
  updateStructure,
  deleteStructure,
  subscribeToStructures,
}
