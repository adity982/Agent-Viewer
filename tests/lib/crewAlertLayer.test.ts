import { describe, expect, it } from 'vitest';
import { drawCrewAlertOverlay } from '../../src/crew/crewAlertLayer';
import { crewAlertDescriptor } from '../../src/crew/crewAlertBridge';

function recordingCtx() {
  const arcs: unknown[][] = [];
  const drawnImages: unknown[][] = [];
  const fillStyles: string[] = [];
  const strokeStyles: string[] = [];
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key === 'arc') return (...args: unknown[]) => arcs.push(args);
      if (key === 'drawImage') return (...args: unknown[]) => drawnImages.push(args);
      if (key === 'save' || key === 'restore' || key === 'beginPath' || key === 'fill' || key === 'stroke') return () => {};
      return () => {};
    },
    set(_target, key, value) {
      if (key === 'fillStyle') fillStyles.push(value as string);
      if (key === 'strokeStyle') strokeStyles.push(value as string);
      return true;
    },
  });
  return { ctx, arcs, drawnImages, fillStyles, strokeStyles };
}

describe('Capa de superposición de alertas Crew (#153)', () => {
  it('no dibuja nada cuando la opacidad llega a 0', () => {
    const { ctx, arcs, drawnImages } = recordingCtx();
    drawCrewAlertOverlay(ctx, { x: 0, y: 0 }, false, { descriptor: crewAlertDescriptor('error'), opacity: 0 });
    expect(arcs).toHaveLength(0);
    expect(drawnImages).toHaveLength(0);
  });

  it('usa el icono real si se provee, sin dibujar el glifo de respaldo', () => {
    const { ctx, drawnImages, arcs } = recordingCtx();
    const icon = {} as HTMLImageElement;
    drawCrewAlertOverlay(ctx, { x: 0, y: 0 }, false, { descriptor: crewAlertDescriptor('blocked'), opacity: 1, icon });
    expect(drawnImages).toHaveLength(1);
    expect(drawnImages[0][0]).toBe(icon);
    // Solo el arco del halo de fondo, sin arco adicional de glifo de respaldo.
    expect(arcs.length).toBe(1);
  });

  it('sin icono, dibuja un glifo de respaldo vectorial (la alerta nunca desaparece)', () => {
    const { ctx, drawnImages, arcs } = recordingCtx();
    drawCrewAlertOverlay(ctx, { x: 0, y: 0 }, false, { descriptor: crewAlertDescriptor('incident'), opacity: 1 });
    expect(drawnImages).toHaveLength(0);
    // Arco de halo + arco del punto de respaldo.
    expect(arcs.length).toBe(2);
  });

  it('usa el color del descriptor para el halo y el glifo de respaldo', () => {
    const { ctx, fillStyles, strokeStyles } = recordingCtx();
    const descriptor = crewAlertDescriptor('connectivity');
    drawCrewAlertOverlay(ctx, { x: 0, y: 0 }, false, { descriptor, opacity: 1 });
    expect(strokeStyles).toContain(descriptor.color);
    expect(fillStyles).toContain(descriptor.color);
  });

  it('se ancla más arriba cuando ya se dibujó un sprite, para quedar sobre la cabeza', () => {
    const withSprite = recordingCtx();
    drawCrewAlertOverlay(withSprite.ctx, { x: 5, y: 100 }, true, { descriptor: crewAlertDescriptor('waiting'), opacity: 1 });
    const withoutSprite = recordingCtx();
    drawCrewAlertOverlay(withoutSprite.ctx, { x: 5, y: 100 }, false, { descriptor: crewAlertDescriptor('waiting'), opacity: 1 });
    const anchorY = (arcs: unknown[][]) => (arcs[0] as number[])[1];
    expect(anchorY(withSprite.arcs)).toBeLessThan(anchorY(withoutSprite.arcs));
  });
});
