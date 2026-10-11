/**
 * Culling de actores y mobiliario fuera de vista (issue #158, "batch/culling de
 * actores/partículas"). `renderCrewRoom` recorría y dibujaba TODO el mobiliario y
 * TODOS los marcadores de la sala activa sin importar el zoom/pan de la cámara: con
 * la cámara acercada o desplazada, los items completamente fuera del lienzo igual
 * emitían su `drawImage`/`fillText`. Estas funciones puras calculan, en el mismo
 * espacio de coordenadas locales que usa `crewIsoPoint`/`crewGeometryBounds` (antes
 * de aplicar `ctx.translate`/`ctx.scale`), el área realmente visible dado el
 * encuadre de cámara actual, para que el orquestador pueda saltarse por completo el
 * dibujo de lo que cae fuera de ella.
 */
export interface CrewCullBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Margen por defecto, en las mismas unidades locales que `crewIsoPoint` (antes del
 * escalado de cámara). Cubre el alto real de un sprite dibujado sobre su ancla
 * (`CREW_CEO_SPRITE.displayHeight` = 76, con el 0.9375 de ancla extendiéndose unos
 * 71px por encima del punto) más la insignia de presencia dibujada sobre él, con
 * holgura para que un agente o mueble nunca aparezca/desaparezca de golpe (pop-in)
 * mientras siga parcialmente en pantalla.
 */
export const CREW_CULL_MARGIN = 160;

/**
 * Calcula el área visible en coordenadas locales (antes de cámara), dado el tamaño
 * real del lienzo, el factor de encuadre (`crewFitScale`), el zoom/pan de la cámara
 * y el centro de la geometría de la sala (`crewGeometryBounds`). Es la inversa de la
 * transformación que aplica `renderCrewRoom` (`translate(width/2+pan)`,
 * `scale(fit*zoom)`, `translate(-center)`), expandida por `margin` en cada borde.
 */
export function crewVisibleLocalBounds(width: number, height: number, fit: number, zoom: number,
  pan: { x: number; y: number }, center: { x: number; y: number }, margin: number = CREW_CULL_MARGIN): CrewCullBounds {
  const scale = fit * zoom;
  return {
    minX: (0 - width / 2 - pan.x) / scale + center.x - margin,
    maxX: (width - width / 2 - pan.x) / scale + center.x + margin,
    minY: (0 - height / 2 - pan.y) / scale + center.y - margin,
    maxY: (height - height / 2 - pan.y) / scale + center.y + margin,
  };
}

/** Un punto está fuera de vista (culled) si cae fuera del área visible en cualquier eje. */
export function crewIsPointCulled(point: { x: number; y: number }, bounds: CrewCullBounds): boolean {
  return point.x < bounds.minX || point.x > bounds.maxX || point.y < bounds.minY || point.y > bounds.maxY;
}
