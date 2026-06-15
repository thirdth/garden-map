import { useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { LogOut, Mountain, Waves, Sun, Sprout, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useYards } from '../hooks/useYards'
import { useElevation } from '../hooks/useElevation'
import { useWaterFlow, WaterFlowDir } from '../hooks/useWaterFlow'
import { useShade } from '../hooks/useShade'
import { usePlantings } from '../hooks/usePlantings'
import { CreateYardForm } from './CreateYardForm'
import { YardGrid } from './YardGrid'
import { ElevationPalette } from './ElevationPalette'
import { WaterFlowPalette } from './WaterFlowPalette'
import { ShadePalette } from './ShadePalette'
import { PlantSearch } from './PlantSearch'
import { SeasonSlider } from './SeasonSlider'
import { Yard, ShadeValue, Plant, Planting } from '../types'

type PaintOverlay = 'elevation' | 'waterflow' | 'shade' | null

interface Props {
  session: Session
}

export function GardenApp({ session }: Props) {
  const { yards, loading, createYard } = useYards()
  const [activeYard, setActiveYard] = useState<Yard | null>(null)

  // Visibility (each overlay can be on independently)
  const [showElevation, setShowElevation] = useState(false)
  const [showWaterFlow, setShowWaterFlow] = useState(false)
  const [showShade, setShowShade] = useState(false)

  // Which overlay is receiving paint strokes
  const [paintOverlay, setPaintOverlay] = useState<PaintOverlay>(null)

  // Selected paint values
  const [paintElevation, setPaintElevation] = useState<number | null>(1)
  const [paintFlow, setPaintFlow] = useState<WaterFlowDir | null>('S')
  const [paintShade, setPaintShade] = useState<ShadeValue | null>('shade_2')

  // Plants
  const [showPlants, setShowPlants] = useState(true)
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null)
  const [selectedPlanting, setSelectedPlanting] = useState<Planting | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1)

  const currentYard = activeYard ?? yards[0] ?? null

  const { elevations, paintCell: paintElevationCell } = useElevation(currentYard?.id ?? '')
  const { flowMap, paintCell: paintFlowCell } = useWaterFlow(currentYard?.id ?? '')
  const { shadeMap, paintCell: paintShadeCell } = useShade(currentYard?.id ?? '')
  const { plantings, addPlanting, removePlanting } = usePlantings(currentYard?.id ?? '')

  const handleCreate = async (name: string, widthFt: number, heightFt: number, cellSizeInches: number) => {
    const yard = await createYard(name, widthFt, heightFt, cellSizeInches)
    setActiveYard(yard)
  }

  function handlePaintCell(row: number, col: number) {
    if (!currentYard) return
    if (paintOverlay === 'elevation') paintElevationCell(row, col, paintElevation)
    if (paintOverlay === 'waterflow') paintFlowCell(row, col, paintFlow)
    if (paintOverlay === 'shade') paintShadeCell(row, col, paintShade)
  }

  function handlePlantCell(row: number, col: number) {
    if (!selectedPlant) return
    addPlanting(selectedPlant.id, selectedPlant.display_name, selectedPlant.taxonomic_type, row, col)
    setSelectedPlanting(null)
  }

  function handleRemovePlanting() {
    if (!selectedPlanting) return
    removePlanting(selectedPlanting.id)
    setSelectedPlanting(null)
  }

  // Clicking an overlay button:
  // • Off → turn on + make active paint target
  // • On + active paint target → turn off + clear paint target
  // • On + not paint target → make active paint target (keep visible)
  function handleOverlayToggle(overlay: 'elevation' | 'waterflow' | 'shade') {
    const shown = { elevation: showElevation, waterflow: showWaterFlow, shade: showShade }
    const setShown = { elevation: setShowElevation, waterflow: setShowWaterFlow, shade: setShowShade }

    if (!shown[overlay]) {
      setShown[overlay](true)
      setPaintOverlay(overlay)
    } else if (paintOverlay === overlay) {
      setShown[overlay](false)
      setPaintOverlay(null)
    } else {
      setPaintOverlay(overlay)
    }
  }

  const overlayButtonClass = (overlay: 'elevation' | 'waterflow' | 'shade', activeColor: string, ringColor: string) => {
    const shown = { elevation: showElevation, waterflow: showWaterFlow, shade: showShade }
    const isShown = shown[overlay]
    const isActive = paintOverlay === overlay
    if (!isShown) return 'text-stone-500 border-stone-200 hover:bg-stone-50'
    if (isActive) return `${activeColor} ring-2 ${ringColor} ring-offset-1`
    return `${activeColor} opacity-60`
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-base font-semibold text-stone-800">Garden Mapper</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-stone-400">{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()}
            className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-stone-400 text-sm">Loading…</span>
        </div>
      ) : yards.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            <div className="text-center">
              <p className="text-stone-700 font-medium">Welcome to Garden Mapper</p>
              <p className="text-stone-400 text-sm mt-1">Start by creating your first yard.</p>
            </div>
            <CreateYardForm onCreate={handleCreate} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Toolbar */}
          <div className="bg-white border-b border-stone-200 px-4 py-2 flex items-center gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-2">
              {yards.map(yard => (
                <button key={yard.id} onClick={() => setActiveYard(yard)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    yard.id === currentYard?.id
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
                  }`}>
                  {yard.name}
                </button>
              ))}
              <CreateYardForm onCreate={handleCreate} compact />
            </div>

            <div className="h-5 w-px bg-stone-200" />

            <button onClick={() => handleOverlayToggle('elevation')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${overlayButtonClass('elevation', 'bg-amber-50 text-amber-700 border-amber-200', 'ring-amber-300')}`}>
              <Mountain size={14} /> Elevation
            </button>

            <button onClick={() => handleOverlayToggle('waterflow')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${overlayButtonClass('waterflow', 'bg-blue-50 text-blue-700 border-blue-200', 'ring-blue-300')}`}>
              <Waves size={14} /> Water Flow
            </button>

            <button onClick={() => handleOverlayToggle('shade')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${overlayButtonClass('shade', 'bg-slate-100 text-slate-700 border-slate-300', 'ring-slate-400')}`}>
              <Sun size={14} /> Shade
            </button>

            <div className="h-5 w-px bg-stone-200" />

            <div className="h-5 w-px bg-stone-200" />
            <SeasonSlider month={currentMonth} onChange={setCurrentMonth} />

            <div className="h-5 w-px bg-stone-200" />
            <button onClick={() => setShowPlants(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                showPlants
                  ? 'bg-green-50 text-green-700 border-green-200 ring-2 ring-green-300 ring-offset-1'
                  : 'text-stone-500 border-stone-200 hover:bg-stone-50'
              }`}>
              <Sprout size={14} />
              Plants{plantings.length > 0 ? ` (${plantings.length})` : ''}
            </button>
          </div>

          {/* Palette bars — stacked when multiple overlays are visible */}
          {showElevation && (
            <div className="bg-stone-50 border-b border-stone-200 px-4 py-2 flex items-center gap-3 shrink-0">
              <ElevationPalette
                selected={paintElevation}
                onSelect={v => { setPaintElevation(v); setPaintOverlay('elevation') }}
              />
              {paintOverlay === 'elevation' && (
                <span className="text-xs text-stone-400">
                  {paintElevation !== null
                    ? `Painting ${paintElevation > 0 ? '+' : ''}${paintElevation}${paintElevation === 0 ? ' (flat)' : ''}`
                    : 'Eraser active'}
                </span>
              )}
            </div>
          )}

          {showWaterFlow && (
            <div className="bg-stone-50 border-b border-stone-200 px-4 py-2 flex items-center gap-3 shrink-0">
              <WaterFlowPalette
                selected={paintFlow}
                onSelect={v => { setPaintFlow(v); setPaintOverlay('waterflow') }}
              />
              {paintOverlay === 'waterflow' && (
                <span className="text-xs text-stone-400">
                  {paintFlow !== null ? `Painting ${paintFlow}` : 'Eraser active'}
                </span>
              )}
            </div>
          )}

          {showPlants && (
            <div className="bg-stone-50 border-b border-stone-200 px-4 py-2 flex items-center gap-3 shrink-0 flex-wrap">
              <PlantSearch selected={selectedPlant} onSelect={p => { setSelectedPlant(p); setSelectedPlanting(null) }} />
              {selectedPlant && (
                <span className="text-xs text-green-700 font-medium shrink-0">
                  Click a cell to place
                </span>
              )}
              {selectedPlanting && (
                <div className="flex items-center gap-2 ml-auto shrink-0 bg-white border border-stone-200 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-stone-600 font-medium">{selectedPlanting.display_name}</span>
                  <button
                    onClick={handleRemovePlanting}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium border border-red-200 rounded px-2 py-0.5 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={11} /> Remove
                  </button>
                  <button
                    onClick={() => setSelectedPlanting(null)}
                    className="text-xs text-stone-400 hover:text-stone-600"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}

          {showShade && (
            <div className="bg-stone-50 border-b border-stone-200 px-4 py-2 flex items-center gap-3 shrink-0">
              <ShadePalette
                selected={paintShade}
                onSelect={setPaintShade}
                onActivate={() => setPaintOverlay('shade')}
              />
              {paintOverlay === 'shade' && (
                <span className="text-xs text-stone-400">
                  {paintShade !== null ? `Painting ${paintShade.replace(/_/g, ' ')}` : 'Eraser active'}
                </span>
              )}
            </div>
          )}

          {currentYard && (
            <div className="px-4 py-1.5 bg-stone-50 border-b border-stone-100 shrink-0">
              <span className="text-xs text-stone-400">
                {currentYard.width_cells} × {currentYard.height_cells} cells
                ({Math.round(currentYard.width_cells * currentYard.cell_size_inches / 12)}′ ×{' '}
                {Math.round(currentYard.height_cells * currentYard.cell_size_inches / 12)}′,{' '}
                {currentYard.cell_size_inches}″ cells)
              </span>
            </div>
          )}

          {currentYard && (
            <YardGrid
              yard={currentYard}
              showElevation={showElevation}
              elevations={elevations}
              paintElevation={paintElevation}
              showWaterFlow={showWaterFlow}
              flowMap={flowMap}
              paintFlow={paintFlow}
              showShade={showShade}
              shadeMap={shadeMap}
              paintShade={paintShade}
              paintOverlay={paintOverlay}
              onPaintCell={handlePaintCell}
              showPlants={showPlants}
              plantings={plantings}
              selectedPlanting={selectedPlanting}
              placingPlant={selectedPlant !== null}
              onPlantCell={handlePlantCell}
              onPlantingClick={p => { setSelectedPlanting(p); setSelectedPlant(null) }}
              currentMonth={currentMonth}
            />
          )}
        </div>
      )}
    </div>
  )
}
