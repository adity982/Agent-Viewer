import { describe, expect, it } from 'vitest';
import {
  CREW_ALERT_KINDS,
  admitCrewAlert,
  crewAlertDedupeKey,
  crewAlertDescriptor,
  crewAlertInstance,
  crewAlertKindFromAgentStatus,
  crewAlertKindFromEventType,
  isCrewAlertKind,
  pickCrewAlertByPriority,
  type CrewAlertCooldownState,
} from '../../src/crew/crewAlertBridge';
import type { AgentStatus, EventType } from '../../src/types/agent';

describe('Lista literal de estados Crew (#153): nunca se inventa un estado fuera del issue', () => {
  it('contiene exactamente los 10 estados pedidos por el issue, ni uno más ni uno menos', () => {
    expect([...CREW_ALERT_KINDS].sort()).toEqual([
      'approval.approved',
      'approval.rejected',
      'approval.requested',
      'blocked',
      'connectivity',
      'error',
      'incident',
      'task.done',
      'tool.running',
      'waiting',
    ].sort());
    expect(CREW_ALERT_KINDS.length).toBe(10);
  });

  it('isCrewAlertKind rechaza cualquier valor que no esté en la lista literal', () => {
    expect(isCrewAlertKind('waiting')).toBe(true);
    expect(isCrewAlertKind('incident')).toBe(true);
    expect(isCrewAlertKind('celebrating')).toBe(false);
    expect(isCrewAlertKind('cost_alert')).toBe(false);
    expect(isCrewAlertKind(42)).toBe(false);
  });
});

describe('crewAlertDescriptor: mapeo a icono/color/texto es-en/duración/cooldown/prioridad', () => {
  it('cada uno de los 10 estados tiene un descriptor completo y bilingüe', () => {
    for (const kind of CREW_ALERT_KINDS) {
      const descriptor = crewAlertDescriptor(kind);
      expect(descriptor.kind).toBe(kind);
      expect(descriptor.icon.length).toBeGreaterThan(0);
      expect(descriptor.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(descriptor.textoEs.length).toBeGreaterThan(0);
      expect(descriptor.textoEn.length).toBeGreaterThan(0);
      expect(descriptor.textoEs).not.toBe(descriptor.textoEn);
      expect(descriptor.duration).toBeGreaterThan(0);
      expect(descriptor.cooldown).toBeGreaterThanOrEqual(descriptor.duration);
      expect(descriptor.priority).toBeGreaterThan(0);
      expect(['low', 'normal', 'high', 'critical']).toContain(descriptor.severity);
    }
  });

  it('usa solo los 9 iconos ya migrados del banco (assets/crew/bank/effects)', () => {
    const allowedIcons = ['wifi', 'check', 'blocked', 'tool', 'thought', 'alert', 'sync', 'terminal', 'call'];
    for (const kind of CREW_ALERT_KINDS) {
      expect(allowedIcons).toContain(crewAlertDescriptor(kind).icon);
    }
  });

  it('error e incident son críticos; task.done y approval.approved son de severidad baja', () => {
    expect(crewAlertDescriptor('error').severity).toBe('critical');
    expect(crewAlertDescriptor('incident').severity).toBe('critical');
    expect(crewAlertDescriptor('task.done').severity).toBe('low');
    expect(crewAlertDescriptor('approval.approved').severity).toBe('low');
  });
});

describe('Prioridad entre alertas simultáneas del mismo agente', () => {
  it('escoge la de mayor prioridad cuando hay varias activas a la vez', () => {
    const waiting = crewAlertInstance({ agentId: 'a1', kind: 'waiting' });
    const incident = crewAlertInstance({ agentId: 'a1', kind: 'incident' });
    const blocked = crewAlertInstance({ agentId: 'a1', kind: 'blocked' });
    expect(pickCrewAlertByPriority([waiting, incident, blocked])).toBe(incident);
    expect(pickCrewAlertByPriority([waiting, blocked])).toBe(blocked);
  });

  it('devuelve null sin alertas', () => {
    expect(pickCrewAlertByPriority([])).toBeNull();
  });

  it('una alerta crítica siempre gana sobre una de severidad baja, cualquiera sea el orden recibido', () => {
    const done = crewAlertInstance({ agentId: 'a1', kind: 'task.done' });
    const error = crewAlertInstance({ agentId: 'a1', kind: 'error' });
    expect(pickCrewAlertByPriority([done, error])).toBe(error);
    expect(pickCrewAlertByPriority([error, done])).toBe(error);
  });
});

describe('Cooldown: no repetir la misma alerta antes de que expire', () => {
  it('rechaza una repetición del mismo evento dentro de la ventana de cooldown', () => {
    const event = { agentId: 'a1', kind: 'blocked' as const };
    const first = admitCrewAlert({}, event, 1000);
    expect(first.admitted?.kind).toBe('blocked');
    const second = admitCrewAlert(first.state, event, 1500);
    expect(second.admitted).toBeNull();
    // El estado no cambia mientras sigue en cooldown.
    expect(second.state).toBe(first.state);
  });

  it('admite la alerta de nuevo una vez expirado el cooldown', () => {
    const event = { agentId: 'a1', kind: 'blocked' as const };
    const first = admitCrewAlert({}, event, 1000);
    const cooldownMs = crewAlertDescriptor('blocked').cooldown;
    const third = admitCrewAlert(first.state, event, 1000 + cooldownMs + 1);
    expect(third.admitted?.kind).toBe('blocked');
  });
});

describe('Dedupe por dedupeKey: dos eventos equivalentes no generan dos alertas', () => {
  it('la dedupeKey depende del agente y del estado', () => {
    expect(crewAlertDedupeKey('a1', 'waiting')).toBe(crewAlertDedupeKey('a1', 'waiting'));
    expect(crewAlertDedupeKey('a1', 'waiting')).not.toBe(crewAlertDedupeKey('a2', 'waiting'));
    expect(crewAlertDedupeKey('a1', 'waiting')).not.toBe(crewAlertDedupeKey('a1', 'blocked'));
  });

  it('un discriminador distinto (p. ej. otra tarea) no se deduplica contra el anterior', () => {
    let state: CrewAlertCooldownState = {};
    const first = admitCrewAlert(state, { agentId: 'a1', kind: 'task.done', discriminator: 'task-1' }, 1000);
    state = first.state;
    const second = admitCrewAlert(state, { agentId: 'a1', kind: 'task.done', discriminator: 'task-2' }, 1001);
    expect(first.admitted).not.toBeNull();
    expect(second.admitted).not.toBeNull();
  });

  it('el mismo discriminador sí se deduplica mientras la ventana sigue activa', () => {
    let state: CrewAlertCooldownState = {};
    const first = admitCrewAlert(state, { agentId: 'a1', kind: 'task.done', discriminator: 'task-1' }, 1000);
    state = first.state;
    const second = admitCrewAlert(state, { agentId: 'a1', kind: 'task.done', discriminator: 'task-1' }, 1001);
    expect(second.admitted).toBeNull();
  });
});

describe('Derivación desde el dominio real (snapshot/eventos), nunca una suposición', () => {
  it('mapea los AgentStatus reales a su estado de alerta correspondiente', () => {
    const cases: Array<[AgentStatus, ReturnType<typeof crewAlertKindFromAgentStatus>]> = [
      ['WAITING', 'waiting'],
      ['USING_TOOL', 'tool.running'],
      ['BLOCKED', 'blocked'],
      ['ERROR', 'error'],
      ['WAITING_APPROVAL', 'approval.requested'],
      ['DONE', 'task.done'],
    ];
    for (const [status, expected] of cases) {
      expect(crewAlertKindFromAgentStatus(status)).toBe(expected);
    }
  });

  it('un status sin alerta asociada (disponible, en reunión, etc.) no inventa ningún estado', () => {
    const neutralStatuses: AgentStatus[] = ['AVAILABLE', 'IDLE', 'IN_MEETING', 'CODING', 'OFFLINE'];
    for (const status of neutralStatuses) {
      expect(crewAlertKindFromAgentStatus(status)).toBeNull();
    }
  });

  it('mapea los EventType reales que corresponden a aprobación concedida y conectividad', () => {
    const cases: Array<[EventType, ReturnType<typeof crewAlertKindFromEventType>]> = [
      ['approval.approved', 'approval.approved'],
      ['runtime.connected', 'connectivity'],
      ['runtime.disconnected', 'connectivity'],
    ];
    for (const [type, expected] of cases) {
      expect(crewAlertKindFromEventType(type)).toBe(expected);
    }
  });

  it('un EventType sin alerta asociada no inventa ningún estado', () => {
    const neutral: EventType[] = ['agent.registered', 'meeting.started', 'social.message'];
    for (const type of neutral) {
      expect(crewAlertKindFromEventType(type)).toBeNull();
    }
  });
});
