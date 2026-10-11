import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCrewPropImages } from '../../src/crew/useCrewPropImages';
import { crewSharedImageCache } from '../../src/crew/crewAssetCache';

/**
 * Reuso de imágenes de mobiliario entre salas via la caché LRU compartida (#158).
 * Antes de esta entrega, `useCrewPropImages` decodificaba de cero la imagen del
 * banco cada vez que se volvía a montar la sala Dirección (ver el comentario
 * "sin caché global" que tenía `useCrewPropImages.ts`).
 */
describe('useCrewPropImages: reuso entre salas via la caché LRU compartida (#158)', () => {
  afterEach(() => { crewSharedImageCache.clear(); });

  it('al volver a montar la sala, reutiliza la imagen del escritorio ya decodificada', async () => {
    // `function`, no arrow: `vi.fn()` solo soporta `new` sobre funciones/clases reales.
    function fakeDeskImage() {
      return { naturalWidth: 168, naturalHeight: 100, src: '',
        onload: null as (() => void) | null, onerror: null, removeAttribute: vi.fn() } as unknown as HTMLImageElement;
    }
    const createImage = vi.fn(fakeDeskImage);
    const originalImage = globalThis.Image;
    globalThis.Image = createImage;
    try {
      const first = renderHook(() => useCrewPropImages(['desk-executive']));
      await waitFor(() => expect(createImage).toHaveBeenCalledTimes(1));
      const created = createImage.mock.results[0]?.value as HTMLImageElement;
      act(() => { created.onload!(new Event('load') as never); });
      await waitFor(() => expect(first.result.current.images['desk-executive']).toBe(created));
      first.unmount();
      expect(created.removeAttribute).not.toHaveBeenCalled();

      const second = renderHook(() => useCrewPropImages(['desk-executive']));
      await waitFor(() => expect(second.result.current.images['desk-executive']).toBe(created));
      expect(createImage).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.Image = originalImage;
    }
  });
});
