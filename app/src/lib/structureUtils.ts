import type { GridPoint, PolylineGeometry, PolygonGeometry, PointGeometry, RectangleGeometry } from '../types'

export function normalizePoint(point: GridPoint) {
  return { x: point.col + 0.5, y: point.row + 0.5 }
}

export function rectangleContains(rect: RectangleGeometry, cell: GridPoint) {
  const top = rect.anchor.row
  const left = rect.anchor.col
  const bottom = top + rect.height - 1
  const right = left + rect.width - 1
  return cell.row >= top && cell.row <= bottom && cell.col >= left && cell.col <= right
}

export function pointInPolygon(x: number, y: number, points: { x: number; y: number }[]) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x
    const yi = points[i].y
    const xj = points[j].x
    const yj = points[j].y
    const intersects = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
    if (intersects) inside = !inside
  }
  return inside
}

export function polygonContains(polygon: PolygonGeometry, cell: GridPoint) {
  const points = polygon.points.map(p => normalizePoint(p))
  return pointInPolygon(cell.col + 0.5, cell.row + 0.5, points)
}

export function polylineContains(polyline: PolylineGeometry, cell: GridPoint) {
  return polyline.points.some(p => p.row === cell.row && p.col === cell.col)
}

export function pointMatches(point: PointGeometry, cell: GridPoint) {
  return point.point.row === cell.row && point.point.col === cell.col
}

export function structureHitTest(cell: GridPoint, geometry: RectangleGeometry | PolygonGeometry | PolylineGeometry | PointGeometry) {
  switch (geometry.shape) {
    case 'rectangle': return rectangleContains(geometry, cell)
    case 'polygon': return polygonContains(geometry, cell)
    case 'polyline': return polylineContains(geometry, cell)
    case 'point': return pointMatches(geometry, cell)
    default: return false
  }
}

export function geometryToSvgPoints(geometry: PolygonGeometry | PolylineGeometry) {
  return geometry.points.map(p => `${p.col + 0.5},${p.row + 0.5}`).join(' ')
}
