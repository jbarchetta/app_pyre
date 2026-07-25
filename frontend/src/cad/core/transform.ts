import type { CadBounds, CadPoint, ViewportTransform } from "./types";

/**
 * Convierte un punto en coordenadas del mundo CAD (mm) a píxeles de pantalla.
 */
export function worldToScreen(point: CadPoint, transform: ViewportTransform): { x: number; y: number } {
  return {
    x: point.x * transform.zoom + transform.panX,
    y: point.y * transform.zoom + transform.panY,
  };
}

/**
 * Convierte un punto en píxeles de pantalla a coordenadas del mundo CAD (mm).
 */
export function screenToWorld(pixel: { x: number; y: number }, transform: ViewportTransform): CadPoint {
  return {
    x: (pixel.x - transform.panX) / transform.zoom,
    y: (pixel.y - transform.panY) / transform.zoom,
  };
}

/**
 * Calcula la transformación de viewport para centrar y ajustar los límites del dibujo en el contenedor.
 */
export function calculateFitToScreen(
  bounds: CadBounds,
  containerWidth: number,
  containerHeight: number,
  paddingPx = 40
): ViewportTransform {
  const widthMm = Math.max(10, bounds.maxX - bounds.minX);
  const heightMm = Math.max(10, bounds.maxY - bounds.minY);

  const availWidth = Math.max(100, containerWidth - paddingPx * 2);
  const availHeight = Math.max(100, containerHeight - paddingPx * 2);

  const zoomX = availWidth / widthMm;
  const zoomY = availHeight / heightMm;
  const zoom = Math.min(zoomX, zoomY);

  const worldCenterX = bounds.minX + widthMm / 2;
  const worldCenterY = bounds.minY + heightMm / 2;

  const panX = containerWidth / 2 - worldCenterX * zoom;
  const panY = containerHeight / 2 - worldCenterY * zoom;

  return { zoom, panX, panY };
}

/**
 * Aplica zoom focalizado hacia un punto de pantalla (cursor del ratón).
 */
export function zoomAtPoint(
  pixel: { x: number; y: number },
  currentTransform: ViewportTransform,
  targetZoom: number
): ViewportTransform {
  const clampedZoom = Math.max(0.1, Math.min(10, targetZoom));
  const worldPoint = screenToWorld(pixel, currentTransform);

  const newPanX = pixel.x - worldPoint.x * clampedZoom;
  const newPanY = pixel.y - worldPoint.y * clampedZoom;

  return {
    zoom: clampedZoom,
    panX: newPanX,
    panY: newPanY,
  };
}

/**
 * Centra los límites del dibujo en el contenedor manteniendo el nivel de zoom actual.
 */
export function centerOnScreen(
  bounds: CadBounds,
  zoom: number,
  containerWidth: number,
  containerHeight: number
): ViewportTransform {
  const widthMm = Math.max(10, bounds.maxX - bounds.minX);
  const heightMm = Math.max(10, bounds.maxY - bounds.minY);

  const worldCenterX = bounds.minX + widthMm / 2;
  const worldCenterY = bounds.minY + heightMm / 2;

  const panX = containerWidth / 2 - worldCenterX * zoom;
  const panY = containerHeight / 2 - worldCenterY * zoom;

  return { zoom, panX, panY };
}
