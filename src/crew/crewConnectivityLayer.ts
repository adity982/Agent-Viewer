import type { CrewConnectivityVisualState } from './crewConnectivityIndicator';

/**
 * Capa de superposición de conectividad Crew (issue #145 sub-alcance Wi-Fi, ver #273 para el
 * resto: arte de teléfono por rol, que sigue a cargo del propietario). Dibuja un aviso visual
 * (anillo + icono wifi/alerta) a partir del `RealtimeStatus` real del stream del dominio, ya
 * mapeado por `crewConnectivityIndicator.ts`. Molde calcado de `crewCallLayer.ts`, pero un
 * módulo totalmente independiente: no importa ni modifica nada de la superposición de llamada
 * real ya entregada (anillo de teléfono, `crewCallTimeline.ts`, pose del CEO), que sigue
 * intacta y puede dibujarse sobre el mismo punto sin interferencia.
 *
 * Recibe el punto ya proyectado por la cámara (igual que `crewHudLayer`/`crewCallLayer`), así
 * que zoom/pan/las cuatro orientaciones siguen funcionando sin ningún cálculo adicional aquí.
 * Si el icono real del banco (`wifi.svg`/`alert.svg`, vía `crewConnectivityIcon.ts`) no cargó,
 * dibuja un glifo de respaldo con una paleta equivalente, para que el aviso nunca desaparezca
 * por un fallo de red del propio icono.
 */
export interface CrewConnectivityOverlayStyle {
  state: CrewConnectivityVisualState;
  /** 0..1: fase del pulso de anillo. Debe ser 0 cuando `reducedMotion` o el estado no es `connecting`. */
  pulseT: number;
  /** Icono wifi.svg ya cargado (estados `online`/`connecting`). */
  wifiIcon?: HTMLImageElement;
  /** Icono alert.svg ya cargado (estado `offline`). */
  alertIcon?: HTMLImageElement;
}

const CONNECTIVITY_ICON_SIZE = 18;
const WIFI_RING_COLOR = '#0d9488';
const ALERT_RING_COLOR = '#f1c40f';

/**
 * Reloj de pulso puro del anillo de conectividad: 0..1 en un ciclo de `periodMs`. Sin
 * `Date.now()` ni rAF. Mismo contrato que `crewCallPulseValue` de `crewCallLayer.ts`, pero
 * deliberadamente un módulo propio e independiente: esta entrega no toca nada de la lógica
 * de teléfono/llamada ya existente.
 */
export function crewConnectivityPulseValue(elapsedMs: number, periodMs = 900): number {
  if (periodMs <= 0) return 0;
  const clamped = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  return (clamped % periodMs) / periodMs;
}

export function drawCrewConnectivityOverlay(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  spriteDrawn: boolean,
  style: CrewConnectivityOverlayStyle,
): void {
  const anchorY = point.y - (spriteDrawn ? 86 : 34);
  const ringColor = style.state === 'offline' ? ALERT_RING_COLOR : WIFI_RING_COLOR;
  ctx.save();
  if (style.state === 'connecting') {
    for (const offset of [0, 0.5]) {
      const t = (style.pulseT + offset) % 1;
      ctx.beginPath();
      ctx.arc(point.x, anchorY, 10 + t * 14, 0, Math.PI * 2);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1 - t;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.beginPath();
    ctx.arc(point.x, anchorY, 12, 0, Math.PI * 2);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // El estado `offline` siempre usa el icono de alerta, nunca el de wifi, aunque ambos ya
  // estén cargados en memoria (por ejemplo, tras pasar por `online` antes de caer).
  const icon = style.state === 'offline' ? style.alertIcon : style.wifiIcon;
  if (icon) {
    ctx.drawImage(icon, point.x - CONNECTIVITY_ICON_SIZE / 2, anchorY - CONNECTIVITY_ICON_SIZE / 2,
      CONNECTIVITY_ICON_SIZE, CONNECTIVITY_ICON_SIZE);
  } else if (style.state === 'offline') {
    // Glifo de respaldo: misma paleta que effects/alert.svg (fondo claro, triángulo amarillo).
    ctx.beginPath();
    ctx.arc(point.x, anchorY, CONNECTIVITY_ICON_SIZE / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(point.x, anchorY - 5);
    ctx.lineTo(point.x + 5, anchorY + 4);
    ctx.lineTo(point.x - 5, anchorY + 4);
    ctx.closePath();
    ctx.fillStyle = '#f1c40f';
    ctx.fill();
  } else {
    // Glifo de respaldo: misma paleta que effects/wifi.svg (fondo claro, ondas teal).
    ctx.beginPath();
    ctx.arc(point.x, anchorY, CONNECTIVITY_ICON_SIZE / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(point.x, anchorY + 2, 5, 4, 0, Math.PI, 0);
    ctx.strokeStyle = '#0d9488';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}
