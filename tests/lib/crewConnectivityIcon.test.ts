import { describe, expect, it, vi } from 'vitest';
import { CREW_CONNECTIVITY_ICON_SIZE, loadCrewAlertIcon, loadCrewWifiIcon } from '../../src/crew/crewConnectivityIcon';

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const fakeImage = (width: number, height: number) => ({ naturalWidth: width, naturalHeight: height, src: '',
  onload: null, onerror: null, removeAttribute: vi.fn() }) as unknown as HTMLImageElement;

describe('Icono de Wi-Fi Crew (#145 sub-alcance, #273): carga real del banco con respaldo vectorial', () => {
  it('carga el icono wifi.svg real con las dimensiones reales del SVG del banco', async () => {
    const image = fakeImage(CREW_CONNECTIVITY_ICON_SIZE.width, CREW_CONNECTIVITY_ICON_SIZE.height);
    const ready = vi.fn(), failed = vi.fn(), url = vi.fn(async () => '/fixture-wifi.svg');
    const stop = loadCrewWifiIcon(ready, failed, url, () => image);
    await flush();
    expect(url).toHaveBeenCalledOnce();
    expect(image.src).toBe('/fixture-wifi.svg');
    image.onload!(new Event('load'));
    expect(ready).toHaveBeenCalledExactlyOnceWith(image);
    expect(failed).not.toHaveBeenCalled();
    stop();
    expect(image.onload).toBeNull();
  });

  it('reporta el fallo (el llamador dibuja el glifo de respaldo) si el recurso no está disponible', async () => {
    const failed = vi.fn();
    loadCrewWifiIcon(vi.fn(), failed, async () => { throw new Error('offline'); });
    await flush(); await flush();
    expect(failed).toHaveBeenCalledOnce();
  });

  it('conserva el aviso de respaldo si las dimensiones no coinciden con el original del banco', async () => {
    const image = fakeImage(1, 1);
    const ready = vi.fn(), failed = vi.fn();
    loadCrewWifiIcon(ready, failed, async () => '/bad.svg', () => image);
    await flush();
    image.onload!(new Event('load'));
    expect(ready).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledOnce();
  });
});

describe('Icono de alerta/desconexión Crew (#145 sub-alcance, #273): carga real del banco con respaldo vectorial', () => {
  it('carga el icono alert.svg real con las dimensiones reales del SVG del banco', async () => {
    const image = fakeImage(CREW_CONNECTIVITY_ICON_SIZE.width, CREW_CONNECTIVITY_ICON_SIZE.height);
    const ready = vi.fn(), failed = vi.fn(), url = vi.fn(async () => '/fixture-alert.svg');
    const stop = loadCrewAlertIcon(ready, failed, url, () => image);
    await flush();
    expect(url).toHaveBeenCalledOnce();
    expect(image.src).toBe('/fixture-alert.svg');
    image.onload!(new Event('load'));
    expect(ready).toHaveBeenCalledExactlyOnceWith(image);
    expect(failed).not.toHaveBeenCalled();
    stop();
  });

  it('reporta el fallo si el recurso de alerta no está disponible', async () => {
    const failed = vi.fn();
    loadCrewAlertIcon(vi.fn(), failed, async () => { throw new Error('offline'); });
    await flush(); await flush();
    expect(failed).toHaveBeenCalledOnce();
  });
});
