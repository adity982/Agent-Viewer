import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CrewStage } from '../../src/crew/CrewStage';
import { CREW_ROOMS } from '../../src/crew/crewModel';

/**
 * Brecha puntual de #169 ("Cambio entre 10 salas no crea múltiples canvas/loops
 * activos ni fugas de memoria") no cubierta por `crewMountLeak.test.tsx` (#158):
 * esa prueba cicla la sala DESMONTANDO Y VOLVIENDO A MONTAR `CrewStage` completo
 * 100 veces, y por separado hace UN solo paso por las once salas vía `rerender`,
 * pero esa segunda prueba solo verifica el número de `<canvas>`, no `requestAnimationFrame`
 * ni listeners. El flujo real del selector de oficina es más agresivo: la MISMA
 * instancia de `CrewStage` permanece montada y cada clic en el selector dispara un
 * `rerender` con un `selectedRoomId` distinto, sin desmontar nunca el componente.
 *
 * Esta prueba repite ese ciclo más de diez veces seguidas sobre una ÚNICA instancia
 * viva (varias vueltas completas al catálogo de once salas, más saltos no
 * secuenciales) y confirma que, en todo momento: nunca hay más de un `<canvas>` en
 * el DOM, nunca hay más de un `requestAnimationFrame` de pintado pendiente, y el
 * `<canvas>` real nunca acumula más de un listener `wheel` activo a la vez, ni
 * `window` más listeners `blur` de los que su propio código fija de forma
 * estable (uno de `CrewStage` que se reconstruye por cada cambio de sala, más
 * uno constante del motor de audio `useCrewAudio`, que solo se crea una vez por
 * montaje y nunca depende de la sala activa), aunque cada cambio de sala
 * reconstruya esas funciones. El seguimiento de listeners se hace a nivel de
 * conjunto realmente adjunto (no solo "altas menos bajas" contadas desde dentro
 * de la prueba, que ocultaría una fuga si el conteo arrancara después del
 * primer montaje).
 */
describe('Cambios repetidos de sala sin desmontar #169', () => {
  let wheelListenersByCanvas: WeakMap<HTMLCanvasElement, Set<EventListenerOrEventListenerObject>>;
  let blurListenersOnWindow: Set<EventListenerOrEventListenerObject>;

  beforeEach(() => {
    vi.useFakeTimers();
    wheelListenersByCanvas = new WeakMap();
    blurListenersOnWindow = new Set();
    const originalCanvasAdd = HTMLCanvasElement.prototype.addEventListener;
    const originalCanvasRemove = HTMLCanvasElement.prototype.removeEventListener;
    vi.spyOn(HTMLCanvasElement.prototype, 'addEventListener').mockImplementation(
      function (this: HTMLCanvasElement, type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
        if (type === 'wheel') {
          const set = wheelListenersByCanvas.get(this) ?? new Set();
          set.add(listener);
          wheelListenersByCanvas.set(this, set);
        }
        return originalCanvasAdd.call(this, type, listener, options);
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'removeEventListener').mockImplementation(
      function (this: HTMLCanvasElement, type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
        if (type === 'wheel') wheelListenersByCanvas.get(this)?.delete(listener);
        return originalCanvasRemove.call(this, type, listener, options);
      },
    );
    const originalWindowAdd = window.addEventListener.bind(window);
    const originalWindowRemove = window.removeEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((...args: Parameters<Window['addEventListener']>) => {
      if (args[0] === 'blur') blurListenersOnWindow.add(args[1] as EventListenerOrEventListenerObject);
      return originalWindowAdd(...args);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((...args: Parameters<Window['removeEventListener']>) => {
      if (args[0] === 'blur') blurListenersOnWindow.delete(args[1] as EventListenerOrEventListenerObject);
      return originalWindowRemove(...args);
    });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('no acumula requestAnimationFrame, listener de wheel en canvas ni listener de blur en window tras más de 10 cambios de sala seguidos', () => {
    const baselineTimers = vi.getTimerCount();
    let roomId = CREW_ROOMS[0].id;
    const { container, rerender, unmount } = render(
      <CrewStage locale="es" selectedRoomId={roomId} persistCamera={false} showRoomLink={false} />,
    );

    // Secuencia: tres vueltas completas por las once salas (33 cambios) más saltos
    // no secuenciales (última, primera, intermedia): más de diez cambios en total.
    const sequence: string[] = [];
    for (let lap = 0; lap < 3; lap++) for (const room of CREW_ROOMS) sequence.push(room.id);
    sequence.push(CREW_ROOMS[CREW_ROOMS.length - 1].id, CREW_ROOMS[0].id, CREW_ROOMS[5 % CREW_ROOMS.length].id);
    expect(sequence.length).toBeGreaterThan(10);

    for (const nextRoom of sequence) {
      roomId = nextRoom;
      rerender(<CrewStage locale="es" selectedRoomId={roomId} persistCamera={false} showRoomLink={false} />);
      const canvases = container.querySelectorAll('canvas');
      // Un único canvas en todo momento: nunca una sala "vieja" apilada sobre la nueva.
      expect(canvases).toHaveLength(1);
      // Un único requestAnimationFrame de pintado pendiente por cambio de sala, nunca acumulados.
      expect(vi.getTimerCount()).toBe(baselineTimers + 1);
      // El canvas real nunca acumula más de un listener de rueda activo, ni window
      // más de los dos listeners de blur estables (CrewStage + useCrewAudio),
      // aunque cada cambio de sala reconstruya el de CrewStage.
      expect(wheelListenersByCanvas.get(canvases[0] as HTMLCanvasElement)?.size ?? 0).toBe(1);
      expect(blurListenersOnWindow.size).toBe(2);
    }

    unmount();
    expect(vi.getTimerCount()).toBe(baselineTimers);
    expect(blurListenersOnWindow.size).toBe(0); // ambos listeners de blur se limpian por completo al desmontar.
    expect(container.querySelectorAll('canvas')).toHaveLength(0);
  });
});
