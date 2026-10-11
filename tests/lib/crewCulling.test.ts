import { describe, expect, it } from 'vitest';
import { crewIsPointCulled, crewVisibleLocalBounds, CREW_CULL_MARGIN } from '../../src/crew/crewCulling';

/**
 * Culling de actores y mobiliario fuera de vista (issue #158, "batch/culling de
 * actores/partículas"). `renderCrewRoom` hoy recorre y dibuja TODO el mobiliario
 * y TODOS los marcadores de la sala activa sin importar el zoom/pan de la
 * cámara: con la cámara acercada o desplazada, items completamente fuera del
 * lienzo igual emiten su `drawImage`/`fillText`. Estas funciones puras calculan,
 * en el mismo espacio de coordenadas locales que usa `crewIsoPoint`/
 * `crewGeometryBounds`, el area realmente visible dado el encuadre de cámara, y
 * si un punto proyectado cae fuera de ella (con un margen para cubrir el alto
 * real de sprites/insignias/mobiliario dibujados sobre su ancla).
 */
describe('Culling de actores y mobiliario Crew (#158)', () => {
  it('con zoom 1 y pan en cero, el area visible es exactamente el lienzo reproyectado alrededor del centro', () => {
    const bounds = crewVisibleLocalBounds(900, 600, 1, 1, { x: 0, y: 0 }, { x: 0, y: 0 }, 0);
    expect(bounds).toEqual({ minX: -450, maxX: 450, minY: -300, maxY: 300 });
  });

  it('el centro de la camara se traslada cuando el centro de la geometria no es el origen', () => {
    const bounds = crewVisibleLocalBounds(900, 600, 1, 1, { x: 0, y: 0 }, { x: 100, y: 50 }, 0);
    expect(bounds).toEqual({ minX: -350, maxX: 550, minY: -250, maxY: 350 });
  });

  it('un zoom mayor reduce el area local visible (se ve menos mundo, mas de cerca)', () => {
    const bounds = crewVisibleLocalBounds(900, 600, 1, 3, { x: 0, y: 0 }, { x: 0, y: 0 }, 0);
    expect(bounds.maxX - bounds.minX).toBeCloseTo(300, 5); // 900 / 3
    expect(bounds.maxY - bounds.minY).toBeCloseTo(200, 5); // 600 / 3
  });

  it('el pan desplaza el area visible en direccion opuesta al desplazamiento de pantalla', () => {
    const bounds = crewVisibleLocalBounds(900, 600, 1, 1, { x: 90, y: 0 }, { x: 0, y: 0 }, 0);
    // Panear la camara +90px a la derecha revela mundo a la izquierda del centro original.
    expect(bounds.minX).toBeCloseTo(-540, 5);
    expect(bounds.maxX).toBeCloseTo(360, 5);
  });

  it('el margen expande el area visible exactamente esa cantidad en cada borde', () => {
    const sinMargen = crewVisibleLocalBounds(900, 600, 1, 1, { x: 0, y: 0 }, { x: 0, y: 0 }, 0);
    const conMargen = crewVisibleLocalBounds(900, 600, 1, 1, { x: 0, y: 0 }, { x: 0, y: 0 }, 50);
    expect(conMargen).toEqual({
      minX: sinMargen.minX - 50, maxX: sinMargen.maxX + 50,
      minY: sinMargen.minY - 50, maxY: sinMargen.maxY + 50,
    });
  });

  it('usa un margen por defecto mayor que cero si no se especifica', () => {
    expect(CREW_CULL_MARGIN).toBeGreaterThan(0);
  });

  it('un punto bien dentro del area no se considera fuera de vista', () => {
    const bounds = { minX: -100, maxX: 100, minY: -100, maxY: 100 };
    expect(crewIsPointCulled({ x: 0, y: 0 }, bounds)).toBe(false);
  });

  it('un punto justo en el borde del area no se considera fuera de vista (inclusivo)', () => {
    const bounds = { minX: -100, maxX: 100, minY: -100, maxY: 100 };
    expect(crewIsPointCulled({ x: -100, y: 50 }, bounds)).toBe(false);
    expect(crewIsPointCulled({ x: 100, y: -100 }, bounds)).toBe(false);
  });

  it('un punto fuera del area en cualquiera de los cuatro lados se considera fuera de vista', () => {
    const bounds = { minX: -100, maxX: 100, minY: -100, maxY: 100 };
    expect(crewIsPointCulled({ x: -101, y: 0 }, bounds)).toBe(true);
    expect(crewIsPointCulled({ x: 101, y: 0 }, bounds)).toBe(true);
    expect(crewIsPointCulled({ x: 0, y: -101 }, bounds)).toBe(true);
    expect(crewIsPointCulled({ x: 0, y: 101 }, bounds)).toBe(true);
  });
});
