import { describe, expect, it } from 'vitest';
import { crewCallPulseValue, drawCrewCallOverlay } from '../../src/crew/crewCallLayer';
import { crewConnectivityPulseValue, drawCrewConnectivityOverlay } from '../../src/crew/crewConnectivityLayer';

function recordingCtx() {
  const arcs: unknown[][] = [];
  const drawnImages: unknown[][] = [];
  const strokeStyles: string[] = [];
  const alphas: number[] = [];
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key === 'arc') return (...args: unknown[]) => arcs.push(args);
      if (key === 'drawImage') return (...args: unknown[]) => drawnImages.push(args);
      if (key === 'save' || key === 'restore' || key === 'beginPath' || key === 'fill' || key === 'stroke') return () => {};
      return () => {};
    },
    set(_target, key, value) {
      if (key === 'strokeStyle') strokeStyles.push(value as string);
      if (key === 'globalAlpha') alphas.push(value as number);
      return true;
    },
  });
  return { ctx, arcs, drawnImages, strokeStyles, alphas };
}

describe('Capa de conectividad Crew (#145 sub-alcance Wi-Fi, #273)', () => {
  it('"online" dibuja un único anillo estático con el icono wifi, sin pulso', () => {
    const { ctx, arcs, drawnImages } = recordingCtx();
    const icon = {} as HTMLImageElement;
    drawCrewConnectivityOverlay(ctx, { x: 0, y: 0 }, false, { state: 'online', pulseT: 0.5, wifiIcon: icon });
    // El anillo estático dibuja un solo arco (sin glifo de respaldo porque el icono real está disponible).
    expect(arcs.length).toBe(1);
    expect(drawnImages).toHaveLength(1);
    expect(drawnImages[0][0]).toBe(icon);
  });

  it('"connecting" dibuja anillos pulsantes (igual que "ringing" en llamada) con el icono wifi', () => {
    const { ctx, arcs, alphas } = recordingCtx();
    drawCrewConnectivityOverlay(ctx, { x: 10, y: 20 }, false, { state: 'connecting', pulseT: 0.25 });
    expect(arcs.length).toBeGreaterThanOrEqual(2);
    expect(alphas.some(alpha => alpha < 1 && alpha > 0)).toBe(true);
  });

  it('"connecting" con pulseT en 0 (reducedMotion) nunca debe fingir un anillo estable de "online"', () => {
    // pulseT=0 sigue siendo fase "connecting": dos anillos en el mismo radio base, no uno solo "online".
    const connecting = recordingCtx();
    drawCrewConnectivityOverlay(connecting.ctx, { x: 0, y: 0 }, false, { state: 'connecting', pulseT: 0 });
    const online = recordingCtx();
    drawCrewConnectivityOverlay(online.ctx, { x: 0, y: 0 }, false, { state: 'online', pulseT: 0, wifiIcon: {} as HTMLImageElement });
    expect(connecting.arcs.length).toBeGreaterThanOrEqual(2);
    expect(online.arcs.length).toBe(1);
  });

  it('"offline" dibuja el icono de alerta, nunca el icono wifi, aunque ambos se hayan cargado', () => {
    const { ctx, drawnImages } = recordingCtx();
    const wifiIcon = { tag: 'wifi' } as unknown as HTMLImageElement;
    const alertIcon = { tag: 'alert' } as unknown as HTMLImageElement;
    drawCrewConnectivityOverlay(ctx, { x: 0, y: 0 }, false, { state: 'offline', pulseT: 0, wifiIcon, alertIcon });
    expect(drawnImages).toHaveLength(1);
    expect(drawnImages[0][0]).toBe(alertIcon);
  });

  it('sin icono cargado, dibuja un glifo de respaldo vectorial (el aviso nunca desaparece por un fallo de red del icono)', () => {
    const { ctx, drawnImages, arcs } = recordingCtx();
    drawCrewConnectivityOverlay(ctx, { x: 0, y: 0 }, false, { state: 'online', pulseT: 0 });
    expect(drawnImages).toHaveLength(0);
    // El glifo de respaldo agrega un arco de círculo además del anillo estático.
    expect(arcs.length).toBe(2);
  });

  it('se ancla más arriba cuando ya se dibujó un sprite, igual que la superposición de llamada', () => {
    const withSprite = recordingCtx();
    drawCrewConnectivityOverlay(withSprite.ctx, { x: 5, y: 100 }, true, { state: 'online', pulseT: 0, wifiIcon: {} as HTMLImageElement });
    const withoutSprite = recordingCtx();
    drawCrewConnectivityOverlay(withoutSprite.ctx, { x: 5, y: 100 }, false, { state: 'online', pulseT: 0, wifiIcon: {} as HTMLImageElement });
    const anchorY = (arcs: unknown[][]) => (arcs[0] as number[])[1];
    expect(anchorY(withSprite.arcs)).toBeLessThan(anchorY(withoutSprite.arcs));
  });

  it('nunca interfiere con la superposición de llamada real ya existente: ambas se pueden dibujar sobre el mismo punto de forma independiente', () => {
    const { ctx, arcs: callArcs } = recordingCtx();
    drawCrewCallOverlay(ctx, { x: 0, y: 0 }, false, { phase: 'talking', pulseT: 0, opacity: 1 });
    const connectivity = recordingCtx();
    drawCrewConnectivityOverlay(connectivity.ctx, { x: 0, y: 0 }, false, { state: 'online', pulseT: 0, wifiIcon: {} as HTMLImageElement });
    // La llamada sigue dibujando su propio glifo de respaldo (2 arcos) sin que exista ningún import cruzado
    // de producción entre ambas capas: cada módulo dibuja sobre su propio contexto simulado sin tocar el otro.
    expect(callArcs.length).toBe(2);
    expect(connectivity.arcs.length).toBe(1);
  });
});

describe('crewConnectivityPulseValue: reloj de pulso puro, independiente del de llamada', () => {
  it('cicla entre 0 y 1 cada periodMs, sin depender de Date.now()', () => {
    expect(crewConnectivityPulseValue(0, 900)).toBe(0);
    expect(crewConnectivityPulseValue(450, 900)).toBeCloseTo(0.5);
    expect(crewConnectivityPulseValue(900, 900)).toBe(0);
    expect(crewConnectivityPulseValue(1350, 900)).toBeCloseTo(0.5);
  });

  it('nunca lanza con entradas degeneradas', () => {
    expect(crewConnectivityPulseValue(-10)).toBe(0);
    expect(crewConnectivityPulseValue(NaN)).toBe(0);
    expect(crewConnectivityPulseValue(10, 0)).toBe(0);
  });

  it('se comporta igual que el reloj de pulso de llamada (mismo contrato, módulo independiente)', () => {
    for (const elapsed of [0, 123, 450, 900, 1350, 2700]) {
      expect(crewConnectivityPulseValue(elapsed, 900)).toBeCloseTo(crewCallPulseValue(elapsed, 900));
    }
  });
});
