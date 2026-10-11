import { describe, expect, it, vi } from 'vitest';
import { CrewLruAssetCache } from '../../src/crew/crewAssetCache';

/**
 * Caché LRU de activos Crew (issue #158, "LRU de assets entre salas").
 *
 * El renderer actual no reutiliza ninguna imagen decodificada entre montajes de
 * `CrewStage`: cada vez que se vuelve a entrar a una sala, `loadCrewSprite`/
 * `loadCrewPropImage` crean un `Image()` nuevo y lo descartan al desmontar,
 * aunque sea exactamente la misma orientación o el mismo mueble ya visto antes
 * (ver comentarios "sin caché global" en `useCrewSprite.ts`/`useCrewPropImages.ts`).
 * Esta estructura pura, sin DOM, acota cuántas imágenes decodificadas se
 * mantienen vivas a la vez entre salas y decide cuál desalojar primero.
 */
describe('Caché LRU de activos Crew (#158)', () => {
  it('get sobre una clave ausente devuelve undefined sin lanzar', () => {
    const cache = new CrewLruAssetCache<string>(3);
    expect(cache.get('ceo-front')).toBeUndefined();
    expect(cache.has('ceo-front')).toBe(false);
    expect(cache.size).toBe(0);
  });

  it('set seguido de get devuelve exactamente el mismo valor', () => {
    const cache = new CrewLruAssetCache<string>(3);
    cache.set('ceo-front', 'imagen-front');
    expect(cache.get('ceo-front')).toBe('imagen-front');
    expect(cache.has('ceo-front')).toBe(true);
    expect(cache.size).toBe(1);
  });

  it('desaloja la entrada menos recientemente usada al superar la capacidad', () => {
    const evicted: Array<[string, string]> = [];
    const cache = new CrewLruAssetCache<string>(2, (key, value) => evicted.push([key, value]));
    cache.set('a', 'imagen-a');
    cache.set('b', 'imagen-b');
    cache.set('c', 'imagen-c'); // 'a' es la mas antigua, debe desalojarse
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.size).toBe(2);
    expect(evicted).toEqual([['a', 'imagen-a']]);
  });

  it('leer una clave la marca como reciente y la protege del siguiente desalojo', () => {
    const cache = new CrewLruAssetCache<string>(2);
    cache.set('a', 'imagen-a');
    cache.set('b', 'imagen-b');
    cache.get('a'); // 'a' vuelve a ser la mas reciente; 'b' queda como la mas antigua
    cache.set('c', 'imagen-c');
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
  });

  it('volver a establecer una clave existente actualiza su valor y su posicion, sin desalojar nada mas', () => {
    const evicted: string[] = [];
    const cache = new CrewLruAssetCache<string>(2, key => evicted.push(key));
    cache.set('a', 'imagen-a-1');
    cache.set('b', 'imagen-b');
    cache.set('a', 'imagen-a-2'); // actualiza 'a' sin que la capacidad se exceda
    expect(cache.size).toBe(2);
    expect(cache.get('a')).toBe('imagen-a-2');
    expect(evicted).toEqual([]);
    cache.set('c', 'imagen-c'); // ahora 'b' es la mas antigua, no 'a'
    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
  });

  it('delete quita una entrada puntual sin desalojar las demas ni invocar onEvict', () => {
    const onEvict = vi.fn();
    const cache = new CrewLruAssetCache<string>(3, onEvict);
    cache.set('a', 'imagen-a');
    cache.set('b', 'imagen-b');
    expect(cache.delete('a')).toBe(true);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.delete('a')).toBe(false); // ya no existe
    expect(onEvict).not.toHaveBeenCalled();
  });

  it('clear invoca onEvict para cada entrada restante y deja el tamano en cero', () => {
    const evicted: string[] = [];
    const cache = new CrewLruAssetCache<string>(3, key => evicted.push(key));
    cache.set('a', 'imagen-a');
    cache.set('b', 'imagen-b');
    cache.clear();
    expect(cache.size).toBe(0);
    expect(evicted.sort()).toEqual(['a', 'b']);
    expect(cache.get('a')).toBeUndefined();
  });

  it('exige una capacidad de al menos una entrada', () => {
    expect(() => new CrewLruAssetCache<string>(0)).toThrow();
    expect(() => new CrewLruAssetCache<string>(-1)).toThrow();
  });
});
