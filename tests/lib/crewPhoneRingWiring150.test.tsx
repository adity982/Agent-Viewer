import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CrewStage } from '../../src/crew/CrewStage';
import { CrewAudioEngine } from '../../src/crew/crewAudioEngine';
import { defaultCrewPreferences } from '../../src/crew/crewPreferences';
import type { Agent } from '../../src/types/agent';

/**
 * Brecha real encontrada al auditar el cierre de #150 (su nota de seguimiento decía
 * "falta cablear #145/#146 al manifiesto"): el efecto de `CrewStage.tsx` que llama
 * `audio.playCue('phone-ring')` cuando detecta una llamada NUEVA (ligado al status
 * real `PHONE_CALL` vía `crewInPhoneCall`, issue #145) nunca tenía ninguna prueba
 * propia. `crewAudioEngine.test.ts` solo prueba que el motor sabe SINTETIZAR el cue
 * `phone-ring` de forma aislada (sin CrewStage), y el E2E de #145
 * (`crew-phone-call-145.spec.ts`) solo verifica el aviso VISUAL, nunca el sonido.
 *
 * Esta prueba cierra ese hueco puntual de cableado real entre #145 y el motor de
 * audio de #150, sin inventar ningún comportamiento nuevo: solo confirma lo que el
 * propio código y sus comentarios ya describen (`CrewStage.tsx`, `crewAudioAssets.ts`).
 *
 * #146 (secuencia de café) queda fuera de esta prueba a propósito: no existe ningún
 * evento real que cablear todavía. `crewClips.ts` documenta en su propio comentario
 * que "ningún clip tiene cuadros animados aún" y el estado `COFFEE_BREAK` solo tiene
 * una pose estática genérica, nunca la secuencia de taza/máquina/vapor que pide #146.
 */

function buildAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'ceo-1',
    name: 'CEO Fixture',
    role: 'boss',
    roleTitle: 'CEO',
    team: 'leadership',
    managerId: null,
    provider: 'anthropic',
    model: 'test-model',
    status: 'CODING',
    statusText: 'Trabajando',
    currentTaskId: null,
    currentTool: null,
    workspace: 'boss_office',
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    isWalking: false,
    facing: 'SE',
    avatarColor: '#000000',
    clothingColor: '#111111',
    hairColor: '#222222',
    accessory: 'none',
    tokensInput: 0,
    tokensOutput: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    cost: 0,
    startedAt: 0,
    speechBubble: null,
    ...overrides,
  };
}

describe('Timbre de teléfono real cableado al motor de audio de Crew (#150 / #145)', () => {
  let playCueSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    playCueSpy = vi.spyOn(CrewAudioEngine.prototype, 'playCue');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('suena "phone-ring" solo cuando un agente visible pasa a PHONE_CALL real, nunca antes', () => {
    const working = buildAgent({ status: 'CODING' });
    const { rerender } = render(
      <CrewStage locale="es" agents={[working]} selectedRoomId="ceo" persistCamera={false}
        preferences={defaultCrewPreferences()} idPrefix="ring-150-new-call" />,
    );
    expect(playCueSpy).not.toHaveBeenCalledWith('phone-ring');

    const onCall = buildAgent({ status: 'PHONE_CALL' });
    rerender(
      <CrewStage locale="es" agents={[onCall]} selectedRoomId="ceo" persistCamera={false}
        preferences={defaultCrewPreferences()} idPrefix="ring-150-new-call" />,
    );
    expect(playCueSpy).toHaveBeenCalledWith('phone-ring');
    expect(playCueSpy).toHaveBeenCalledTimes(1);
  });

  it('no repite el timbre en renderizaciones de la MISMA llamada en curso', () => {
    const onCall = buildAgent({ status: 'PHONE_CALL' });
    const { rerender } = render(
      <CrewStage locale="es" agents={[onCall]} selectedRoomId="ceo" persistCamera={false}
        preferences={defaultCrewPreferences()} idPrefix="ring-150-repeat" />,
    );
    expect(playCueSpy).toHaveBeenCalledTimes(1);

    // Renderizaciones repetidas con el mismo snapshot (p. ej. un tick del cronómetro local
    // del aviso) no deben volver a timbrar: sigue siendo exactamente la misma llamada.
    rerender(
      <CrewStage locale="es" agents={[{ ...onCall }]} selectedRoomId="ceo" persistCamera={false}
        preferences={defaultCrewPreferences()} idPrefix="ring-150-repeat" />,
    );
    rerender(
      <CrewStage locale="es" agents={[{ ...onCall }]} selectedRoomId="ceo" persistCamera={false}
        preferences={defaultCrewPreferences()} idPrefix="ring-150-repeat" />,
    );
    expect(playCueSpy).toHaveBeenCalledTimes(1);
  });

  it('no suena si el agente en llamada no es visible en la sala activa (aislamiento entre salas)', () => {
    const onCallElsewhere = buildAgent({ status: 'PHONE_CALL', workspace: 'boss_office' });
    render(
      // Sala activa "development": el CEO en llamada vive en boss_office y no se proyecta aquí,
      // aunque su registro de llamada exista en el estado (cambiar de sala no lo borra).
      <CrewStage locale="es" agents={[onCallElsewhere]} selectedRoomId="development" persistCamera={false}
        preferences={defaultCrewPreferences()} idPrefix="ring-150-other-room" />,
    );
    expect(playCueSpy).not.toHaveBeenCalledWith('phone-ring');
  });
});
