import { describe, expect, it } from 'vitest';
import {
  crewAgentActivity,
  crewActivityLine,
  crewInPhoneCall,
  crewMinimizedCategory,
  crewSafeSpeechBubble,
  crewSafeStatusText,
  crewViewerModeLabel,
} from '../../src/crew/crewEventBridge';
import type { Meeting, Task } from '../../src/types/agent';

const baseAgent = {
  id: 'agent-1',
  status: 'CODING' as const,
  currentTaskId: null as string | null,
  currentTool: null as string | null,
  tokensInput: 0,
  tokensOutput: 0,
};

const task: Task = {
  id: 'task-1',
  title: 'Migrar el bridge de eventos',
  description: 'texto interno, no se expone',
  initiatorId: 'agent-2',
  assignedAgentId: 'agent-1',
  collaboratorIds: [],
  status: 'IN_PROGRESS',
  progress: 40,
  createdAt: 1,
  tokensTotal: 0,
  costTotal: 0,
  toolsUsed: [],
  artifacts: [],
};

const meeting: Meeting = {
  id: 'meeting-1',
  title: 'Sync de arquitectura',
  topic: 'Revisar el puente Crew',
  initiatorId: 'agent-2',
  participants: ['agent-1', 'agent-2'],
  status: 'ACTIVE',
  startedAt: 1,
  tokensAccumulated: 0,
  costAccumulated: 0,
  agenda: [],
  decisions: [],
  tasksCreated: [],
  messages: [],
};

describe('Puente de eventos Crew (issue #155): actividad por agente', () => {
  it('no inventa tarea ni reunión cuando el agente no las tiene', () => {
    const activity = crewAgentActivity(baseAgent, [], []);
    expect(activity).toEqual({
      id: 'agent-1',
      status: 'CODING',
      taskStatus: null,
      taskLabel: null,
      inMeeting: false,
      meetingLabel: null,
      pendingApproval: false,
      usingTool: false,
      hasUsage: false,
    });
  });

  it('refleja la tarea real asignada por currentTaskId, sin recalcular su estado', () => {
    const agent = { ...baseAgent, currentTaskId: 'task-1' };
    const activity = crewAgentActivity(agent, [task], []);
    expect(activity.taskStatus).toBe('IN_PROGRESS');
    expect(activity.taskLabel).toBe('Migrar el bridge de eventos');
  });

  it('una tarea de otro agente no se le atribuye a este agente', () => {
    const agent = { ...baseAgent, currentTaskId: 'task-ajena' };
    const activity = crewAgentActivity(agent, [task], []);
    expect(activity.taskStatus).toBeNull();
    expect(activity.taskLabel).toBeNull();
  });

  it('solo asigna reunión cuando el propio status del agente es IN_MEETING', () => {
    const inMeeting = { ...baseAgent, status: 'IN_MEETING' as const };
    const activity = crewAgentActivity(inMeeting, [], [meeting]);
    expect(activity.inMeeting).toBe(true);
    expect(activity.meetingLabel).toBe('Revisar el puente Crew');

    // Mismo agente en otro estado: aunque la reunión exista y lo incluya como participante,
    // no se le marca en reunión si su propio status no lo dice.
    const notMeeting = crewAgentActivity(baseAgent, [], [meeting]);
    expect(notMeeting.inMeeting).toBe(false);
    expect(notMeeting.meetingLabel).toBeNull();
  });

  it('una reunión SCHEDULED o CONCLUDED no cuenta como reunión activa', () => {
    const inMeeting = { ...baseAgent, status: 'IN_MEETING' as const };
    const scheduled = crewAgentActivity(inMeeting, [], [{ ...meeting, status: 'SCHEDULED' }]);
    expect(scheduled.inMeeting).toBe(false);
    const concluded = crewAgentActivity(inMeeting, [], [{ ...meeting, status: 'CONCLUDED' }]);
    expect(concluded.inMeeting).toBe(false);
  });

  it('pendingApproval es un espejo directo de WAITING_APPROVAL, no una inferencia', () => {
    expect(crewAgentActivity(baseAgent, [], []).pendingApproval).toBe(false);
    expect(crewAgentActivity({ ...baseAgent, status: 'WAITING_APPROVAL' }, [], []).pendingApproval).toBe(true);
  });

  it('usingTool y hasUsage reflejan solo presencia, nunca el detalle ni la cifra', () => {
    const withTool = crewAgentActivity({ ...baseAgent, currentTool: 'bash' }, [], []);
    expect(withTool.usingTool).toBe(true);
    const withUsage = crewAgentActivity({ ...baseAgent, tokensInput: 500 }, [], []);
    expect(withUsage.hasUsage).toBe(true);
    expect((withUsage as any).tokensInput).toBeUndefined();
  });

  it('visibilidad minimized nunca expone el título de tarea ni el tema de reunión', () => {
    const agent = { ...baseAgent, currentTaskId: 'task-1', status: 'IN_MEETING' as const };
    const minimized = crewAgentActivity(agent, [task], [meeting], 'minimized');
    expect(minimized.taskLabel).toBeNull();
    expect(minimized.meetingLabel).toBeNull();
    // La categoría (estado real) sigue disponible: minimizar no es ocultar que hay una tarea o reunión.
    expect(minimized.taskStatus).toBe('IN_PROGRESS');
    expect(minimized.inMeeting).toBe(true);

    const line = crewActivityLine(minimized, true);
    expect(line).not.toContain('Migrar el bridge de eventos');
    expect(line).not.toContain('Revisar el puente Crew');
    expect(line).toContain('Tarea');
  });

  it('no muta los arreglos de tareas ni reuniones recibidos', () => {
    const tasksBefore = JSON.stringify([task]);
    const meetingsBefore = JSON.stringify([meeting]);
    crewAgentActivity({ ...baseAgent, currentTaskId: 'task-1', status: 'IN_MEETING' as const }, [task], [meeting]);
    expect(JSON.stringify([task])).toBe(tasksBefore);
    expect(JSON.stringify([meeting])).toBe(meetingsBefore);
  });
});

describe('Línea de actividad y rótulo de modo', () => {
  it('compone una línea legible combinando aprobación, reunión, tarea y herramienta', () => {
    const activity = crewAgentActivity(
      { ...baseAgent, currentTaskId: 'task-1', currentTool: 'bash', status: 'WAITING_APPROVAL' as const },
      [task],
      [],
    );
    const line = crewActivityLine(activity, false);
    expect(line).toContain('Awaiting approval');
    expect(line).toContain('Migrar el bridge de eventos');
  });

  it('una actividad vacía produce una línea vacía, no texto inventado', () => {
    expect(crewActivityLine(crewAgentActivity(baseAgent, [], []), true)).toBe('');
  });

  it('crewInPhoneCall (#145) es verdadero solo con el status real PHONE_CALL, nunca por inferencia', () => {
    expect(crewInPhoneCall({ status: 'PHONE_CALL' })).toBe(true);
    expect(crewInPhoneCall({ status: 'IN_MEETING' })).toBe(false);
    expect(crewInPhoneCall({ status: 'IDLE' })).toBe(false);
  });

  it('crewViewerModeLabel cubre los tres modos del vocabulario canónico de la app', () => {
    expect(crewViewerModeLabel('LIVE', true)).toBe('EN VIVO');
    expect(crewViewerModeLabel('LIVE', false)).toBe('LIVE');
    expect(crewViewerModeLabel('DEMO', true)).toBe('DEMO');
    expect(crewViewerModeLabel('REPLAY', true)).toBe('REPRODUCCIÓN');
    expect(crewViewerModeLabel('REPLAY', false)).toBe('REPLAY');
  });
});

describe('Redacción de statusText y speechBubble en modo minimizado (issue #155)', () => {
  const idleActivity = crewAgentActivity(baseAgent, [], []);
  const approvalActivity = crewAgentActivity({ ...baseAgent, status: 'WAITING_APPROVAL' as const }, [], []);
  const meetingActivity = crewAgentActivity({ ...baseAgent, status: 'IN_MEETING' as const }, [], [meeting]);
  const taskActivity = crewAgentActivity({ ...baseAgent, currentTaskId: 'task-1' }, [task], []);
  const toolActivity = crewAgentActivity({ ...baseAgent, currentTool: 'bash' }, [], []);

  describe('crewMinimizedCategory: categoría honesta derivada solo de datos estructurados', () => {
    it('nunca contiene el título real de la tarea ni el tema real de la reunión', () => {
      expect(crewMinimizedCategory(taskActivity, false, true)).not.toContain('Migrar el bridge de eventos');
      expect(crewMinimizedCategory(meetingActivity, false, true)).not.toContain('Revisar el puente Crew');
    });

    it('cubre cada categoría real en español e inglés, con paridad entre ambos', () => {
      const cases: Array<[typeof idleActivity, boolean, string, string]> = [
        [approvalActivity, false, 'Espera aprobación', 'Awaiting approval'],
        [meetingActivity, false, 'En reunión', 'In a meeting'],
        [taskActivity, false, 'Trabajando en una tarea', 'Working on a task'],
        [toolActivity, false, 'Usando herramienta', 'Using a tool'],
        [idleActivity, false, 'Disponible', 'Available'],
      ];
      for (const [activity, inCall, es, en] of cases) {
        expect(crewMinimizedCategory(activity, inCall, true)).toBe(es);
        expect(crewMinimizedCategory(activity, inCall, false)).toBe(en);
      }
    });

    it('una llamada real en curso (#145) produce su propia categoría, nunca inferida de otra señal', () => {
      expect(crewMinimizedCategory(idleActivity, true, true)).toBe('Llamada en curso');
      expect(crewMinimizedCategory(idleActivity, true, false)).toBe('On a call');
    });

    it('respeta una prioridad fija y honesta cuando hay varias señales reales a la vez', () => {
      // Aprobación pendiente es la señal más urgente: gana incluso si también hay reunión y tarea.
      const busy = crewAgentActivity({ ...baseAgent, status: 'WAITING_APPROVAL' as const, currentTaskId: 'task-1' }, [task], []);
      expect(crewMinimizedCategory(busy, true, true)).toBe('Espera aprobación');
    });
  });

  describe('crewSafeStatusText: nunca expone Agent.statusText real en modo minimizado', () => {
    const realStatusText = 'Ejecutando TASK-99: Migrar credenciales de producción';

    it('en modo full devuelve el statusText real sin tocarlo', () => {
      expect(crewSafeStatusText(realStatusText, taskActivity, false, 'full', true)).toBe(realStatusText);
    });

    it('en modo minimized sustituye el texto real por la categoría honesta, nunca lo contiene', () => {
      const safe = crewSafeStatusText(realStatusText, taskActivity, false, 'minimized', true);
      expect(safe).toBe('Trabajando en una tarea');
      expect(safe).not.toContain('TASK-99');
      expect(safe).not.toContain('credenciales');
    });

    it('en modo minimized sin ninguna actividad real no inventa contenido, solo informa disponibilidad', () => {
      expect(crewSafeStatusText('', idleActivity, false, 'minimized', true)).toBe('Disponible');
      expect(crewSafeStatusText('', idleActivity, false, 'minimized', false)).toBe('Available');
    });
  });

  describe('crewSafeSpeechBubble: nunca repite el texto real del mensaje en modo minimizado', () => {
    const realBubble = {
      text: 'Propongo recortar el alcance de la migración de pagos',
      expiresAt: 5000,
      kind: 'proposal' as const,
    };

    it('en modo full devuelve el globo real sin cambios', () => {
      expect(crewSafeSpeechBubble(realBubble, meetingActivity, false, 'full', true)).toEqual(realBubble);
    });

    it('en modo minimized conserva vigencia y tipo reales, pero sustituye el texto por la categoría', () => {
      const safe = crewSafeSpeechBubble(realBubble, meetingActivity, false, 'minimized', true);
      expect(safe).not.toBeNull();
      expect(safe!.text).toBe('En reunión');
      expect(safe!.text).not.toContain('Propongo');
      expect(safe!.expiresAt).toBe(5000);
      expect(safe!.kind).toBe('proposal');
    });

    it('sin globo real no fabrica uno: minimized devuelve null igual que full', () => {
      expect(crewSafeSpeechBubble(null, meetingActivity, false, 'minimized', true)).toBeNull();
      expect(crewSafeSpeechBubble(null, meetingActivity, false, 'full', true)).toBeNull();
    });
  });
});
