import { loadCrewImage } from './crewSprites';

/**
 * Iconos de conectividad del banco Crew (`assets/crew/bank/effects/wifi.svg` y
 * `assets/crew/bank/effects/alert.svg`, issue #145 sub-alcance Wi-Fi, ver #273). Mismo
 * molde que `crewCallIcon.ts`: dimensiones reales del SVG, la validación de integridad de
 * `loadCrewImage` rechaza cualquier archivo que no coincida exactamente.
 */
export const CREW_CONNECTIVITY_ICON_SIZE = { width: 40, height: 40 } as const;

/** Carga el icono wifi; si falla, `drawCrewConnectivityOverlay` dibuja un glifo de respaldo. */
export function loadCrewWifiIcon(ready: (image: HTMLImageElement) => void, failed: () => void,
  loadUrl: () => Promise<string> = async () => (await import('./sprites/effect-wifi')).default,
  createImage = () => new Image()): () => void {
  return loadCrewImage(loadUrl, CREW_CONNECTIVITY_ICON_SIZE, ready, failed, createImage);
}

/** Carga el icono de alerta/desconexión; si falla, `drawCrewConnectivityOverlay` dibuja un glifo de respaldo. */
export function loadCrewAlertIcon(ready: (image: HTMLImageElement) => void, failed: () => void,
  loadUrl: () => Promise<string> = async () => (await import('./sprites/effect-alert')).default,
  createImage = () => new Image()): () => void {
  return loadCrewImage(loadUrl, CREW_CONNECTIVITY_ICON_SIZE, ready, failed, createImage);
}
