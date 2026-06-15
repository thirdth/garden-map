import { useState } from 'react'
import { X, Pencil, Trash2 } from 'lucide-react'
import { usePlantDetail } from '../hooks/usePlantDetail'
import { getPlantColors } from '../lib/plantIcons'
import { NC_COLOR_MAP } from '../lib/plantSeasons'
import { Planting, PlantDetail } from '../types'

interface Props {
  plantId: string
  planting?: Planting
  onUpdatePlanting?: (fields: { planted_date?: string | null; custom_label?: string | null; notes?: string | null }) => void
  onRemovePlanting?: () => void
  onClose: () => void
}

// ── Inline editable field ────────────────────────────────────────────────────

function EditableField({
  value,
  placeholder,
  onSave,
  hint,
}: {
  value: string | null
  placeholder: string
  onSave: (v: string | null) => void
  hint?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  function commit() {
    onSave(draft.trim() || null)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        placeholder={placeholder}
        className="text-xs border border-green-400 rounded px-1.5 py-0.5 w-28 focus:outline-none"
      />
    )
  }

  return (
    <button
      onClick={() => { setDraft(value ?? ''); setEditing(true) }}
      className="flex items-center gap-1 group text-xs"
      title={hint}
    >
      {value
        ? <span className="text-stone-700">{value}</span>
        : <span className="text-stone-300 italic">{placeholder}</span>}
      <Pencil size={9} className="text-stone-300 group-hover:text-stone-500 shrink-0" />
    </button>
  )
}

function EditableTextarea({
  value,
  placeholder,
  onSave,
}: {
  value: string | null
  placeholder: string
  onSave: (v: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  function commit() {
    onSave(draft.trim() || null)
    setEditing(false)
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        rows={3}
        className="text-xs border border-green-400 rounded px-2 py-1 w-full focus:outline-none resize-none"
        placeholder={placeholder}
      />
    )
  }

  return (
    <button
      onClick={() => { setDraft(value ?? ''); setEditing(true) }}
      className="flex items-start gap-1 group text-xs text-left w-full"
    >
      {value
        ? <span className="text-stone-700 whitespace-pre-wrap">{value}</span>
        : <span className="text-stone-300 italic">{placeholder}</span>}
      <Pencil size={9} className="text-stone-300 group-hover:text-stone-500 shrink-0 mt-0.5" />
    </button>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-stone-100 pt-3 mt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-2">{title}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] text-stone-400 w-24 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function Tags({ values }: { values: string[] | null }) {
  if (!values?.length) return <span className="text-xs text-stone-300">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {values.map(v => (
        <span key={v} className="text-[10px] bg-stone-100 text-stone-600 rounded px-1.5 py-0.5">{v}</span>
      ))}
    </div>
  )
}

function ColorDots({ values }: { values: string[] | null }) {
  if (!values?.length) return <span className="text-xs text-stone-300">—</span>
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map(v => (
        <span key={v} className="flex items-center gap-1 text-xs text-stone-600">
          <span
            className="inline-block w-3 h-3 rounded-full border border-stone-200 shrink-0"
            style={{ backgroundColor: NC_COLOR_MAP[v] ?? '#e5e7eb' }}
          />
          {v}
        </span>
      ))}
    </div>
  )
}

function ft(min: number | null, max: number | null, unit = '′') {
  if (!min && !max) return '—'
  if (min === max || !max) return `${min}${unit}`
  if (!min) return `up to ${max}${unit}`
  return `${min}–${max}${unit}`
}

function primaryName(p: PlantDetail): string {
  return p.plant_common_names?.find(n => n.is_primary)?.name
    ?? p.plant_common_names?.[0]?.name
    ?? [p.genus, p.species, p.cultivar ? `'${p.cultivar}'` : null].filter(Boolean).join(' ')
}

function scientificName(p: PlantDetail): string {
  return [p.genus, p.species, p.cultivar ? `'${p.cultivar}'` : null].filter(Boolean).join(' ')
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlantDetailPanel({ plantId, planting, onUpdatePlanting, onRemovePlanting, onClose }: Props) {
  const { plant, loading, updatePlant } = usePlantDetail(plantId)

  const colors = plant ? getPlantColors(plant.taxonomic_type) : { bg: '#f1f5f9', fg: '#475569' }

  return (
    <div className="w-80 shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-stone-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {loading || !plant ? (
              <div className="h-4 w-40 bg-stone-100 rounded animate-pulse" />
            ) : (
              <>
                <p className="font-semibold text-stone-800 text-sm leading-tight truncate">{primaryName(plant)}</p>
                <p className="text-xs text-stone-400 italic mt-0.5 truncate">{scientificName(plant)}</p>
                <span
                  className="inline-block mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: colors.bg, color: colors.fg }}
                >
                  {plant.taxonomic_type}
                </span>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 shrink-0">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
        {loading && <p className="text-xs text-stone-400">Loading…</p>}

        {plant && (
          <>
            {/* Description */}
            {plant.description && (
              <p className="text-xs text-stone-500 leading-relaxed">{plant.description}</p>
            )}

            <Section title="Size">
              <Row label="Height"><span className="text-xs text-stone-700">{ft(plant.height_min_ft, plant.height_max_ft)}</span></Row>
              <Row label="Spread"><span className="text-xs text-stone-700">{ft(plant.spread_min_ft, plant.spread_max_ft)}</span></Row>
              {(plant.spacing_min_ft || plant.spacing_max_ft) && (
                <Row label="Spacing"><span className="text-xs text-stone-700">{ft(plant.spacing_min_ft, plant.spacing_max_ft)}</span></Row>
              )}
            </Section>

            <Section title="Care">
              <Row label="Light"><Tags values={plant.light} /></Row>
              <Row label="Water"><span className="text-xs text-stone-700">{plant.watering_need ?? '—'}</span></Row>
              <Row label="Soil"><Tags values={plant.soil_texture} /></Row>
              <Row label="Drainage"><Tags values={plant.soil_drainage} /></Row>
              {(plant.usda_hardiness_zone_min || plant.usda_hardiness_zone_max) && (
                <Row label="USDA Zones">
                  <span className="text-xs text-stone-700">{ft(plant.usda_hardiness_zone_min, plant.usda_hardiness_zone_max, '')}</span>
                </Row>
              )}
              <Row label="Growth rate"><span className="text-xs text-stone-700">{plant.growth_rate ?? '—'}</span></Row>
              <Row label="Maintenance"><span className="text-xs text-stone-700">{plant.maintenance ?? '—'}</span></Row>
            </Section>

            <Section title="Bloom">
              <Row label="Seasons"><Tags values={plant.bloom_seasons} /></Row>
              {plant.bloom_window_text && (
                <Row label="Window"><span className="text-xs text-stone-500 italic">{plant.bloom_window_text}</span></Row>
              )}
              <Row label="Flower color"><ColorDots values={plant.flower_color} /></Row>
              <Row label="Bloom start">
                <EditableField
                  value={plant.bloom_start_md}
                  placeholder="MM-DD"
                  hint="Exact bloom start date for seasonal rendering"
                  onSave={v => updatePlant({ bloom_start_md: v })}
                />
              </Row>
              <Row label="Bloom end">
                <EditableField
                  value={plant.bloom_end_md}
                  placeholder="MM-DD"
                  onSave={v => updatePlant({ bloom_end_md: v })}
                />
              </Row>
            </Section>

            <Section title="Foliage">
              <Row label="Leaf color"><ColorDots values={plant.leaf_color} /></Row>
              <Row label="Fall color"><ColorDots values={plant.deciduous_fall_color} /></Row>
              <Row label="Foliage color">
                <EditableField
                  value={plant.foliage_color}
                  placeholder="e.g. Green"
                  onSave={v => updatePlant({ foliage_color: v })}
                />
              </Row>
              <Row label="Dieback">
                <EditableField
                  value={plant.dieback_start_md}
                  placeholder="MM-DD"
                  hint="When herbaceous plants die back"
                  onSave={v => updatePlant({ dieback_start_md: v })}
                />
              </Row>
              <Row label="Regrowth">
                <EditableField
                  value={plant.regrowth_start_md}
                  placeholder="MM-DD"
                  onSave={v => updatePlant({ regrowth_start_md: v })}
                />
              </Row>
            </Section>

            {((plant.attracts?.length ?? 0) > 0 || (plant.wildlife_value?.length ?? 0) > 0) && (
              <Section title="Wildlife">
                {(plant.attracts?.length ?? 0) > 0 && <Row label="Attracts"><Tags values={plant.attracts} /></Row>}
                {(plant.wildlife_value?.length ?? 0) > 0 && <Row label="Value"><Tags values={plant.wildlife_value} /></Row>}
              </Section>
            )}

            {(plant.ecological_tags?.length ?? 0) > 0 && (
              <Section title="Ecology">
                <Tags values={plant.ecological_tags} />
              </Section>
            )}

            {/* Planting-specific section */}
            {planting && onUpdatePlanting && (
              <Section title="This Planting">
                <Row label="Planted">
                  <EditableField
                    value={planting.planted_date}
                    placeholder="YYYY-MM-DD"
                    onSave={v => onUpdatePlanting({ planted_date: v })}
                  />
                </Row>
                <Row label="Label">
                  <EditableField
                    value={planting.custom_label}
                    placeholder="Custom name"
                    onSave={v => onUpdatePlanting({ custom_label: v })}
                  />
                </Row>
                <Row label="Notes">
                  <EditableTextarea
                    value={planting.notes}
                    placeholder="Add notes…"
                    onSave={v => onUpdatePlanting({ notes: v })}
                  />
                </Row>
                {onRemovePlanting && (
                  <button
                    onClick={onRemovePlanting}
                    className="mt-2 flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded px-2 py-1 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={11} /> Remove planting
                  </button>
                )}
              </Section>
            )}

            {/* Other common names */}
            {(plant.plant_common_names?.length ?? 0) > 1 && (
              <Section title="Also known as">
                <div className="flex flex-wrap gap-1">
                  {plant.plant_common_names.filter(n => !n.is_primary).map(n => (
                    <span key={n.name} className="text-[10px] text-stone-500 bg-stone-50 rounded px-1.5 py-0.5">{n.name}</span>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
