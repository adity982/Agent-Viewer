import type { RealtimeStatus } from '../integrations/realtimeClient';

/**
 * Indicador de conectividad genérico de Crew (sub-alcance Wi-Fi de la issue #145, ver #273
 * para el resto: arte de teléfono por rol, que sigue a cargo del propietario). Módulo de
 * datos puro: mapea el `RealtimeStatus` real del stream del dominio
 * (`src/integrations/realtimeClient.ts`, ya consumido en vivo por `livePhase` en
 * `src/App.tsx`) a un estado visual honesto. Nunca inventa un estado de conexión que
 * `RealtimeStatus` no reporte de verdad: no hay ningún "DEMO" ni simulación propia aquí,
 * a diferencia del anillo de llamada de #145 que sí es un efecto puramente visual.
 */
export type CrewConnectivityVisualState = 'online' | 'connecting' | 'offline';

/** Único status real que cuenta como conectado de verdad. */
const ONLINE_STATUSES: ReadonlySet<RealtimeStatus> = new Set<RealtimeStatus>(['connected']);

/** Fases reales transitorias: nunca se muestran como "conectado", tampoco como "sin conexión" definitiva. */
const CONNECTING_STATUSES: ReadonlySet<RealtimeStatus> = new Set<RealtimeStatus>([
  'connecting', 'reconnecting', 'resyncing',
]);

/**
 * Mapea un `RealtimeStatus` real a un estado visual de conectividad. Cualquier valor que no
 * sea exactamente un status real "conectado" o "transitorio" conocido (incluidos
 * `disconnected`/`error`/`closed`, y cualquier valor futuro que este módulo todavía no
 * conozca) cae al lado seguro, `offline`, en vez de fingir una conexión que no está
 * confirmada.
 */
export function crewConnectivityVisualState(status: RealtimeStatus): CrewConnectivityVisualState {
  if (ONLINE_STATUSES.has(status)) return 'online';
  if (CONNECTING_STATUSES.has(status)) return 'connecting';
  return 'offline';
}

export interface CrewConnectivityIconSpec {
  /** Icono real del banco Crew a dibujar (`crewConnectivityIcon.ts`). */
  icon: 'wifi' | 'alert';
  /** Si el aviso debe animarse con un pulso (fase transitoria real, nunca un estado estable). */
  pulse: boolean;
}

/** Qué icono real del banco y qué animación corresponden a cada estado visual. */
export function crewConnectivityIconSpec(state: CrewConnectivityVisualState): CrewConnectivityIconSpec {
  switch (state) {
    case 'online': return { icon: 'wifi', pulse: false };
    case 'connecting': return { icon: 'wifi', pulse: true };
    case 'offline': return { icon: 'alert', pulse: false };
  }
}

/** Atajo directo desde el `RealtimeStatus` real hasta el icono a dibujar, sin estado intermedio propio. */
export function crewConnectivityIconFromStatus(status: RealtimeStatus): CrewConnectivityIconSpec {
  return crewConnectivityIconSpec(crewConnectivityVisualState(status));
}
