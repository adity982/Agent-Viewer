import type { AgentStatus, EventType } from '../types/agent';
import type { EventSeverity } from '../integrations/canonicalTypes';

/**
 * Puente de datos puro para alertas y estados Crew (issue #153). Mapea el snapshot/los eventos
 * reales del agente a una descripción visual y bilingüe de la alerta: icono, color, textos es/en,
 * duración, cooldown, dedupe y prioridad. No crea datos nuevos ni calcula métricas: reutiliza
 * `EventSeverity` (`integrations/canonicalTypes.ts`) y los 9 iconos del banco ya migrados
 * (`docs/crew/ASSET-MIGRATION-PR43.md`, `assets/crew/bank/effects/*.svg`). Nunca produce un estado
 * fuera de la lista literal del issue.
 */

/** Los 10 estados literales que pide el issue #153; ningún otro valor es válido. */
export const CREW_ALERT_KINDS = [
  'waiting',
  'tool.running',
  'blocked',
  'error',
  'approval.requested',
  'approval.approved',
  'approval.rejected',
  'task.done',
  'connectivity',
  'incident',
] as const;

export type CrewAlertKind = (typeof CREW_ALERT_KINDS)[number];

/** Guardia en tiempo de ejecución: ningún estado fuera de `CREW_ALERT_KINDS` se considera una alerta Crew válida. */
export function isCrewAlertKind(value: unknown): value is CrewAlertKind {
  return typeof value === 'string' && (CREW_ALERT_KINDS as readonly string[]).includes(value);
}

/**
 * Nombre del icono del banco (`assets/crew/bank/effects/<nombre>.svg`, todos en estado `prototype`
 * y ya migrados según `docs/crew/ASSET-MIGRATION-PR43.md`). `call` se excluye deliberadamente del
 * catálogo de abajo: ya está dedicado a la superposición de llamada real (issue #145,
 * `crewCallIcon.ts`/`crewCallLayer.ts`) y esta entrega no lo reutiliza para no mezclar ambos avisos.
 */
export type CrewAlertIconName = 'wifi' | 'check' | 'blocked' | 'tool' | 'thought' | 'alert' | 'sync' | 'terminal';

export interface CrewAlertDescriptor {
  kind: CrewAlertKind;
  icon: CrewAlertIconName;
  /** Color hexadecimal de la severidad, reutilizado por el icono y el glifo de respaldo. */
  color: string;
  textoEs: string;
  textoEn: string;
  /** Severidad real del dominio (`EventSeverity`); Crew nunca inventa una escala propia. */
  severity: EventSeverity;
  /** Cuánto permanece visible la alerta en pantalla, en milisegundos. */
  duration: number;
  /** Tiempo mínimo entre dos apariciones de la misma `dedupeKey`, en milisegundos. */
  cooldown: number;
  /** Prioridad numérica: mayor valor se muestra primero cuando hay varias alertas simultáneas del mismo agente. */
  priority: number;
}

/**
 * Catálogo fijo de los 10 estados. Las duraciones/cooldowns son breves (requisito del issue:
 * "animaciones breves sin flash ni saturación") y crecen con la severidad para que una alerta
 * crítica tenga tiempo de notarse; el cooldown siempre es mayor o igual a la duración, para que la
 * alerta no reaparezca inmediatamente después de desvanecerse por el mismo evento.
 */
const CREW_ALERT_CATALOG: Record<CrewAlertKind, Omit<CrewAlertDescriptor, 'kind'>> = {
  waiting: {
    icon: 'thought', color: '#64748b', textoEs: 'Esperando', textoEn: 'Waiting',
    severity: 'low', duration: 4000, cooldown: 6000, priority: 1,
  },
  'tool.running': {
    icon: 'tool', color: '#2563eb', textoEs: 'Ejecutando herramienta', textoEn: 'Running tool',
    severity: 'normal', duration: 4000, cooldown: 5000, priority: 2,
  },
  'approval.requested': {
    icon: 'sync', color: '#f59e0b', textoEs: 'Aprobación solicitada', textoEn: 'Approval requested',
    severity: 'normal', duration: 6000, cooldown: 8000, priority: 3,
  },
  blocked: {
    icon: 'blocked', color: '#f97316', textoEs: 'Bloqueado', textoEn: 'Blocked',
    severity: 'high', duration: 6000, cooldown: 8000, priority: 4,
  },
  'approval.rejected': {
    icon: 'blocked', color: '#b91c1c', textoEs: 'Aprobación rechazada', textoEn: 'Approval rejected',
    severity: 'high', duration: 6000, cooldown: 8000, priority: 5,
  },
  connectivity: {
    icon: 'wifi', color: '#0ea5e9', textoEs: 'Problema de conectividad', textoEn: 'Connectivity issue',
    severity: 'high', duration: 6000, cooldown: 8000, priority: 5,
  },
  error: {
    icon: 'alert', color: '#dc2626', textoEs: 'Error en el agente', textoEn: 'Agent error',
    severity: 'critical', duration: 8000, cooldown: 10000, priority: 6,
  },
  incident: {
    icon: 'terminal', color: '#991b1b', textoEs: 'Incidente', textoEn: 'Incident',
    severity: 'critical', duration: 8000, cooldown: 10000, priority: 7,
  },
  'approval.approved': {
    icon: 'check', color: '#16a34a', textoEs: 'Aprobación concedida', textoEn: 'Approval granted',
    severity: 'low', duration: 4000, cooldown: 6000, priority: 1,
  },
  'task.done': {
    icon: 'check', color: '#15803d', textoEs: 'Tarea completada', textoEn: 'Task done',
    severity: 'low', duration: 4000, cooldown: 6000, priority: 1,
  },
};

/** Descriptor visual completo y bilingüe para un estado literal del issue #153. */
export function crewAlertDescriptor(kind: CrewAlertKind): CrewAlertDescriptor {
  return { kind, ...CREW_ALERT_CATALOG[kind] };
}

/**
 * Mapea los `AgentStatus` reales del dominio (`types/agent.ts`) a su estado de alerta Crew
 * correspondiente. Solo cubre los estados que son un reflejo directo de un campo real; `null`
 * cuando el status actual no corresponde a ninguno de los 10 (p. ej. agente disponible, en
 * reunión o caminando): Crew nunca completa ese vacío con una suposición.
 */
export function crewAlertKindFromAgentStatus(status: AgentStatus): CrewAlertKind | null {
  switch (status) {
    case 'WAITING': return 'waiting';
    case 'USING_TOOL': return 'tool.running';
    case 'BLOCKED': return 'blocked';
    case 'ERROR': return 'error';
    case 'WAITING_APPROVAL': return 'approval.requested';
    case 'DONE': return 'task.done';
    default: return null;
  }
}

/**
 * Mapea los `EventType` reales (`types/agent.ts`) que corresponden a un estado de alerta Crew.
 * Solo `approval.approved` y los eventos de conectividad del runtime tienen hoy un `EventType`
 * real y sin ambigüedad en el dominio; el resto de tipos no produce ninguna alerta. No existe
 * todavía un `EventType` real para `approval.rejected` ni para `incident` (confirmado en
 * `types/agent.ts`): este puente no inventa uno. Esos dos estados siguen disponibles en el
 * catálogo y pueden emitirse explícitamente (`crewAlertInstance`) en cuanto el dominio incorpore
 * la señal real correspondiente, o desde una capa de monitor que ya sepa distinguirlos.
 */
export function crewAlertKindFromEventType(type: EventType): CrewAlertKind | null {
  switch (type) {
    case 'approval.approved': return 'approval.approved';
    case 'runtime.connected':
    case 'runtime.disconnected': return 'connectivity';
    default: return null;
  }
}

export interface CrewAlertEvent {
  agentId: string;
  kind: CrewAlertKind;
  /**
   * Discrimina alertas del mismo tipo que no deben deduplicarse entre sí (p. ej. dos tareas
   * distintas ambas `task.done`, o dos aprobaciones distintas ambas `approval.requested`).
   * Opcional: sin discriminador, la dedupe/cooldown aplica por agente y tipo únicamente.
   */
  discriminator?: string;
}

/** Clave estable de dedupe: mismo agente + mismo tipo (+ discriminador opcional) = misma alerta. */
export function crewAlertDedupeKey(agentId: string, kind: CrewAlertKind, discriminator?: string): string {
  return discriminator ? `${agentId}:${kind}:${discriminator}` : `${agentId}:${kind}`;
}

export interface CrewAlertInstance extends CrewAlertDescriptor {
  agentId: string;
  dedupeKey: string;
}

/** Instancia completa (descriptor + identidad) para un evento de alerta Crew real. */
export function crewAlertInstance(event: CrewAlertEvent): CrewAlertInstance {
  const descriptor = crewAlertDescriptor(event.kind);
  return { ...descriptor, agentId: event.agentId, dedupeKey: crewAlertDedupeKey(event.agentId, event.kind, event.discriminator) };
}

/**
 * Elige qué alerta mostrar cuando un agente tiene varias activas a la vez (requisito del issue:
 * "overlay por actor... nunca mezclado"; la cámara/zoom no debe esconder una alerta crítica).
 * Mayor `priority` gana; `null` si no hay ninguna.
 */
export function pickCrewAlertByPriority(instances: readonly CrewAlertInstance[]): CrewAlertInstance | null {
  if (instances.length === 0) return null;
  return instances.reduce((best, current) => (current.priority > best.priority ? current : best));
}

export interface CrewAlertCooldownRecord {
  lastShownAt: number;
  /** Instante (ms) hasta el que esta `dedupeKey` sigue en cooldown; no debe reaparecer antes. */
  activeUntil: number;
}

export type CrewAlertCooldownState = Readonly<Record<string, CrewAlertCooldownRecord>>;

export interface CrewAlertAdmission {
  state: CrewAlertCooldownState;
  /** La alerta nueva a mostrar, o `null` si quedó descartada por cooldown/dedupe. */
  admitted: CrewAlertInstance | null;
}

/**
 * Decide si un evento real produce una alerta visible nueva, aplicando cooldown y dedupe por
 * `dedupeKey` en un solo paso: dos eventos equivalentes dentro de la ventana de cooldown de la
 * misma `dedupeKey` cuentan como el mismo aviso y el segundo no se admite. Determinista: misma
 * entrada + mismo `state` + mismo `now` siempre produce el mismo resultado, sin reloj interno
 * (mismo patrón que `advanceCrewCallTimeline` en `crewCallTimeline.ts`).
 */
export function admitCrewAlert(
  state: CrewAlertCooldownState,
  event: CrewAlertEvent,
  now: number,
): CrewAlertAdmission {
  const instance = crewAlertInstance(event);
  const existing = state[instance.dedupeKey];
  if (existing && now < existing.activeUntil) {
    return { state, admitted: null };
  }
  const nextState: CrewAlertCooldownState = {
    ...state,
    [instance.dedupeKey]: { lastShownAt: now, activeUntil: now + instance.cooldown },
  };
  return { state: nextState, admitted: instance };
}
