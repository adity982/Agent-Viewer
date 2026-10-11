import { describe, expect, it, vi } from 'vitest';
import { CREW_ALERT_ICON_SIZE, loadCrewAlertIcon } from '../../src/crew/crewAlertIcon';
import { CREW_ALERT_KINDS, crewAlertDescriptor } from '../../src/crew/crewAlertBridge';

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const fakeImage = (width: number, height: number) => ({ naturalWidth: width, naturalHeight: height, src: '',
  onload: null, onerror: null, removeAttribute: vi.fn() }) as unknown as HTMLImageElement;

describe('Icono de alerta Crew (#153): carga real del banco con respaldo vectorial', () => {
  it('carga el icono con las dimensiones reales del SVG del banco (40x40)', async () => {
    const image = fakeImage(CREW_ALERT_ICON_SIZE.width, CREW_ALERT_ICON_SIZE.height);
    const ready = vi.fn(), failed = vi.fn(), url = vi.fn(async () => '/fixture-alert.svg');
    const stop = loadCrewAlertIcon('alert', ready, failed, url, () => image);
    await flush();
    expect(url).toHaveBeenCalledExactlyOnceWith('alert');
    expect(image.src).toBe('/fixture-alert.svg');
    image.onload!(new Event('load'));
    expect(ready).toHaveBeenCalledExactlyOnceWith(image);
    expect(failed).not.toHaveBeenCalled();
    stop();
    expect(image.onload).toBeNull();
  });

  it('reporta el fallo si el recurso del banco no está disponible (fallback vectorial del llamador)', async () => {
    const failed = vi.fn();
    loadCrewAlertIcon('wifi', vi.fn(), failed, async () => { throw new Error('offline'); });
    await flush(); await flush();
    expect(failed).toHaveBeenCalledOnce();
  });

  it('conserva el aviso de respaldo si las dimensiones no coinciden con el original del banco', async () => {
    const image = fakeImage(1, 1);
    const ready = vi.fn(), failed = vi.fn();
    loadCrewAlertIcon('tool', ready, failed, async () => '/bad.svg', () => image);
    await flush();
    image.onload!(new Event('load'));
    expect(ready).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledOnce();
  });

  it('cada icono usado por el catálogo de alertas tiene una fuente real cargable (resuelve una URL no vacía)', async () => {
    const icons = new Set(CREW_ALERT_KINDS.map((kind) => crewAlertDescriptor(kind).icon));
    for (const icon of icons) {
      const image = fakeImage(CREW_ALERT_ICON_SIZE.width, CREW_ALERT_ICON_SIZE.height);
      const ready = vi.fn(), failed = vi.fn();
      loadCrewAlertIcon(icon, ready, failed, undefined, () => image);
      // La carga real usa `import()` dinámico del módulo del banco: a diferencia de una `loadUrl`
      // de prueba ya resuelta, puede implicar E/S real y tardar más de un par de microtareas.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(image.src.length).toBeGreaterThan(0);
      image.onload!(new Event('load'));
      expect(ready).toHaveBeenCalledOnce();
      expect(failed).not.toHaveBeenCalled();
    }
  });
});
