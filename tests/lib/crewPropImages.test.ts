import { describe, expect, it, vi } from 'vitest';
import { CREW_PROP_IMAGE_SIZE, CREW_ROOM_PROP_IMAGES, loadCrewPropImage } from '../../src/crew/crewPropImages';
import { CrewLruAssetCache } from '../../src/crew/crewAssetCache';

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const fakeImage = (width: number, height: number) => ({ naturalWidth: width, naturalHeight: height, src: '',
  onload: null, onerror: null, removeAttribute: vi.fn() }) as unknown as HTMLImageElement;

describe('Imágenes reales de mobiliario Crew (#115)', () => {
  it('mapea solo el escritorio y la planta de Dirección, alcance acotado del issue', () => {
    expect(CREW_ROOM_PROP_IMAGES).toEqual({ 'ceo-desk': 'desk-executive', 'ceo-plant': 'plant-floor' });
  });

  it('carga la imagen del escritorio ejecutivo y libera sus callbacks al desmontar', async () => {
    const size = CREW_PROP_IMAGE_SIZE['desk-executive'];
    const image = fakeImage(size.width, size.height);
    const ready = vi.fn(), failed = vi.fn(), url = vi.fn(async () => '/fixture-desk.svg');
    const stop = loadCrewPropImage('desk-executive', ready, failed, url, () => image);
    await flush();
    expect(url).toHaveBeenCalledExactlyOnceWith('desk-executive');
    expect(image.src).toBe('/fixture-desk.svg');
    image.onload!(new Event('load'));
    expect(ready).toHaveBeenCalledExactlyOnceWith(image);
    expect(failed).not.toHaveBeenCalled();
    stop();
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
    expect(image.removeAttribute).toHaveBeenCalledWith('src');
  });

  it('carga la imagen de la planta de piso con sus propias dimensiones', async () => {
    const size = CREW_PROP_IMAGE_SIZE['plant-floor'];
    const image = fakeImage(size.width, size.height);
    const ready = vi.fn(), failed = vi.fn();
    loadCrewPropImage('plant-floor', ready, failed, async () => '/fixture-plant.svg', () => image);
    await flush();
    image.onload!(new Event('load'));
    expect(ready).toHaveBeenCalledExactlyOnceWith(image);
    expect(failed).not.toHaveBeenCalled();
  });

  it('conserva el marcador (falla) si las dimensiones no coinciden con el original del banco', async () => {
    const image = fakeImage(1, 1);
    const ready = vi.fn(), failed = vi.fn();
    loadCrewPropImage('desk-executive', ready, failed, async () => '/bad.svg', () => image);
    await flush();
    image.onload!(new Event('load'));
    expect(ready).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledOnce();
  });

  it('no crea imágenes cuando la sala se desmonta antes de resolver el módulo', async () => {
    let resolve!: (url: string) => void;
    const pending = new Promise<string>(done => { resolve = done; });
    const create = vi.fn((w: number, h: number) => fakeImage(w, h));
    const ready = vi.fn(), failed = vi.fn();
    const stop = loadCrewPropImage('plant-floor', ready, failed, () => pending, () => create(0, 0));
    stop(); resolve('/late.svg'); await flush();
    expect(create).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });

  it('reporta error de carga real de la imagen (onerror)', async () => {
    const size = CREW_PROP_IMAGE_SIZE['plant-floor'];
    const image = fakeImage(size.width, size.height);
    const failed = vi.fn();
    loadCrewPropImage('plant-floor', vi.fn(), failed, async () => '/fixture-plant.svg', () => image);
    await flush();
    image.onerror!(new Event('error'));
    expect(failed).toHaveBeenCalledOnce();
  });

  // Caché LRU entre salas (issue #158): opcional, no cambia el comportamiento de las
  // pruebas anteriores de este archivo (ninguna la pasa).
  it('con una caché explícita, reutiliza la imagen del mueble ya decodificada entre salas', async () => {
    const cache = new CrewLruAssetCache<HTMLImageElement>(4);
    const size = CREW_PROP_IMAGE_SIZE['desk-executive'];
    const image = fakeImage(size.width, size.height);
    const ready1 = vi.fn(), failed = vi.fn(), url = vi.fn(async () => '/fixture-desk.svg');
    const stop1 = loadCrewPropImage('desk-executive', ready1, failed, url, () => image, cache, 'prop:desk-executive');
    await flush();
    image.onload!(new Event('load'));
    expect(ready1).toHaveBeenCalledExactlyOnceWith(image);
    stop1();
    expect(image.removeAttribute).not.toHaveBeenCalled(); // la caché conserva la imagen viva

    const create2 = vi.fn(), ready2 = vi.fn();
    const stop2 = loadCrewPropImage('desk-executive', ready2, failed, vi.fn(async () => '/otra.svg'), create2, cache, 'prop:desk-executive');
    await flush();
    expect(create2).not.toHaveBeenCalled();
    expect(ready2).toHaveBeenCalledExactlyOnceWith(image);
    stop2();
    expect(failed).not.toHaveBeenCalled();
  });
});
