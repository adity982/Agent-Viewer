/**
 * Caché LRU de activos decodificados del renderer Crew (issue #158, "LRU de
 * assets entre salas"). Antes de esta entrega, `loadCrewSprite`/
 * `loadCrewPropImage` creaban un `HTMLImageElement` nuevo cada vez que una
 * escena volvía a montarse, aunque fuera exactamente la misma orientación de
 * sprite o el mismo mueble ya decodificado antes (ver los comentarios "sin
 * caché global" que tenían `useCrewSprite.ts`/`useCrewPropImages.ts`). Esta
 * estructura es pura (sin DOM ni temporizadores): solo decide qué conservar y
 * qué desalojar cuando se supera una capacidad fija.
 */
export class CrewLruAssetCache<T> {
  private readonly entries = new Map<string, T>();

  constructor(private readonly maxEntries: number, private readonly onEvict?: (key: string, value: T) => void) {
    if (!Number.isFinite(maxEntries) || maxEntries < 1) {
      throw new RangeError('CrewLruAssetCache requiere una capacidad de al menos 1 entrada');
    }
  }

  /** Devuelve el valor y lo marca como el mas reciente; `undefined` si no esta en caché. */
  get(key: string): T | undefined {
    if (!this.entries.has(key)) return undefined;
    const value = this.entries.get(key)!;
    this.entries.delete(key);
    this.entries.set(key, value); // Map conserva orden de inserción: esto lo mueve al final (mas reciente).
    return value;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  /** Inserta o actualiza una entrada; desaloja la(s) mas antigua(s) si se supera la capacidad. */
  set(key: string, value: T): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string;
      const oldestValue = this.entries.get(oldestKey)!;
      this.entries.delete(oldestKey);
      this.onEvict?.(oldestKey, oldestValue);
    }
  }

  /** Quita una entrada puntual sin invocar `onEvict` (no es un desalojo por capacidad). */
  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  /** Vacía la caché, invocando `onEvict` para cada entrada restante. */
  clear(): void {
    for (const [key, value] of this.entries) this.onEvict?.(key, value);
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

/**
 * Capacidad compartida entre sprites de actores y mobiliario. Acota cuántas imágenes
 * decodificadas de Crew se mantienen vivas a la vez entre salas; generosa para el
 * catálogo actual (4 orientaciones del CEO + variante de teléfono + 2 muebles reales
 * = 7 claves) con holgura para los próximos roles/salas (#118-#123, #130).
 */
const CREW_IMAGE_CACHE_MAX_ENTRIES = 24;

/** Libera los manejadores y el `src` de una imagen desalojada para que el navegador
 * pueda reclamar su memoria decodificada; nunca se desaloja en silencio sin esto. */
function releaseCrewCachedImage(_key: string, image: HTMLImageElement): void {
  image.onload = null;
  image.onerror = null;
  image.removeAttribute('src');
}

/** Instancia única usada por `crewSprites.ts` (claves `sprite:*`) y `crewPropImages.ts`
 * (claves `prop:*`); los prefijos evitan cualquier colisión entre ambos espacios. */
export const crewSharedImageCache = new CrewLruAssetCache<HTMLImageElement>(
  CREW_IMAGE_CACHE_MAX_ENTRIES, releaseCrewCachedImage);
