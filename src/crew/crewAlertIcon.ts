import { loadCrewImage } from './crewSprites';
import type { CrewAlertIconName } from './crewAlertBridge';
import type { CrewLruAssetCache } from './crewAssetCache';

/**
 * Carga de iconos de alerta Crew (issue #153), calcada del patrón de `crewCallIcon.ts` (issue
 * #145): cada icono es un símbolo original del banco ya migrado (`assets/crew/bank/effects/*.svg`,
 * ver `docs/crew/ASSET-MIGRATION-PR43.md`), sin arte nuevo. Si la carga falla o las dimensiones no
 * coinciden con el SVG real, `drawCrewAlertOverlay` dibuja un glifo de respaldo: la alerta nunca
 * desaparece por un fallo de red del propio icono.
 */
export const CREW_ALERT_ICON_SIZE = { width: 40, height: 40 } as const;

const CREW_ALERT_ICON_SOURCES: Record<CrewAlertIconName, () => Promise<{ default: string }>> = {
  wifi: () => import('./sprites/effect-wifi'),
  check: () => import('./sprites/effect-check'),
  blocked: () => import('./sprites/effect-blocked'),
  tool: () => import('./sprites/effect-tool'),
  thought: () => import('./sprites/effect-thought'),
  alert: () => import('./sprites/effect-alert'),
  sync: () => import('./sprites/effect-sync'),
  terminal: () => import('./sprites/effect-terminal'),
};

/** Carga el icono real del banco para una alerta Crew; respaldo vectorial a cargo del llamador. */
export function loadCrewAlertIcon(
  icon: CrewAlertIconName,
  ready: (image: HTMLImageElement) => void,
  failed: () => void,
  loadUrl: (icon: CrewAlertIconName) => Promise<string> = async (name) => (await CREW_ALERT_ICON_SOURCES[name]()).default,
  createImage = () => new Image(),
  cache?: CrewLruAssetCache<HTMLImageElement>,
): () => void {
  return loadCrewImage(() => loadUrl(icon), CREW_ALERT_ICON_SIZE, ready, failed, createImage, cache, `alert-icon:${icon}`);
}
