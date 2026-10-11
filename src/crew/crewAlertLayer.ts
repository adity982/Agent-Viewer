import type { CrewAlertDescriptor } from './crewAlertBridge';

/**
 * Capa de superposición de alertas Crew (issue #153), calcada del patrón de `crewCallLayer.ts`
 * (issue #145): dibuja un halo del color de la severidad más el icono real del banco sobre un
 * actor con una alerta activa. Es un efecto visual puro: no valida nada por sí misma, solo dibuja
 * lo que `crewAlertBridge.ts` ya decidió mostrar. Recibe el punto ya proyectado por la cámara
 * (igual que `crewHudLayer`/`crewCallLayer`), así que zoom/pan/las cuatro orientaciones siguen
 * funcionando sin ningún cálculo adicional aquí.
 *
 * Si el icono real del banco no cargó (`loadCrewAlertIcon`), dibuja un glifo de respaldo genérico
 * (un punto sólido del mismo color) para que el aviso nunca desaparezca por un fallo de red del
 * propio icono. El anclaje horizontal se separa ligeramente del de `drawCrewCallOverlay` para que
 * ambos avisos puedan convivir sin superponerse si un agente está, a la vez, en llamada y con una
 * alerta activa.
 */
export interface CrewAlertOverlayStyle {
  descriptor: CrewAlertDescriptor;
  /** 0..1: opacidad de entrada/salida de la alerta, calculada por el llamador (temporizador propio). */
  opacity: number;
  icon?: HTMLImageElement;
}

const ALERT_ICON_SIZE = 18;
const ALERT_HALO_RADIUS = 11;
const ALERT_FALLBACK_DOT_RADIUS = 4;

export function drawCrewAlertOverlay(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  spriteDrawn: boolean,
  style: CrewAlertOverlayStyle,
): void {
  if (style.opacity <= 0) return;
  const anchorY = point.y - (spriteDrawn ? 86 : 34);
  const anchorX = point.x + 14;
  const color = style.descriptor.color;
  ctx.save();
  ctx.globalAlpha = style.opacity;
  ctx.beginPath();
  ctx.arc(anchorX, anchorY, ALERT_HALO_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (style.icon) {
    ctx.drawImage(style.icon, anchorX - ALERT_ICON_SIZE / 2, anchorY - ALERT_ICON_SIZE / 2, ALERT_ICON_SIZE, ALERT_ICON_SIZE);
  } else {
    // Glifo de respaldo genérico (sin arte nuevo): un punto sólido del color real de la severidad.
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, ALERT_FALLBACK_DOT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}
