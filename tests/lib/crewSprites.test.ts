import { describe, expect, it, vi } from 'vitest';
import { crewSpriteView, loadCrewSprite } from '../../src/crew/crewSprites';
import { CrewLruAssetCache } from '../../src/crew/crewAssetCache';

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const fakeImage = () => ({ naturalWidth:256, naturalHeight:352, src:'', onload:null, onerror:null,
  removeAttribute:vi.fn() }) as unknown as HTMLImageElement;

describe('Carga del piloto ilustrado Crew', () => {
  it('combina las cuatro direcciones del dominio con las cuatro cámaras', () => {
    const views = ['front','right','back','left'] as const;
    const cases = [
      ['SE',['front','left','back','right']],
      ['SW',['left','back','right','front']],
      ['NW',['back','right','front','left']],
      ['NE',['right','front','left','back']],
    ] as const;
    for (const [facing,expected] of cases) {
      const marker = Object.freeze({role:'boss' as const,facing});
      expect(views.map(view=>crewSpriteView(marker,view))).toEqual(expected);
    }
    expect(crewSpriteView({role:'boss',facing:'invalid' as never},'front')).toBeNull();
    expect(crewSpriteView({role:'boss'},'front')).toBe('front');
  });
  it('no asigna el CEO a roles desconocidos o ausentes', () => {
    expect(crewSpriteView({role:'boss'},'back')).toBe('back');
    expect(crewSpriteView({role:'custom'},'front')).toBeNull();
    expect(crewSpriteView({},'front')).toBeNull();
  });
  it('carga solo la vista solicitada y libera sus callbacks', async () => {
    const image=fakeImage(), ready=vi.fn(), failed=vi.fn(), url=vi.fn(async()=>'/fixture.png');
    const stop=loadCrewSprite('left',ready,failed,url,()=>image);
    await flush();
    expect(url).toHaveBeenCalledExactlyOnceWith('left');
    expect(image.src).toBe('/fixture.png');
    image.onload!(new Event('load'));
    expect(ready).toHaveBeenCalledExactlyOnceWith(image);
    expect(failed).not.toHaveBeenCalled();
    stop();
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
    expect(image.removeAttribute).toHaveBeenCalledWith('src');
  });
  it('no crea imágenes cuando la sala se desmonta antes de resolver el módulo', async () => {
    let resolve!: (url:string)=>void;
    const pending=new Promise<string>(done=>{resolve=done;});
    const create=vi.fn(fakeImage), ready=vi.fn(), failed=vi.fn();
    const stop=loadCrewSprite('front',ready,failed,()=>pending,create);
    stop(); resolve('/late.png'); await flush();
    expect(create).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });
  it('descarta errores tardíos y reporta los errores de la carga activa', async () => {
    const failed=vi.fn();
    loadCrewSprite('front',vi.fn(),failed,async()=>{throw Error('missing');});
    await flush(); await flush();
    expect(failed).toHaveBeenCalledOnce();
    const stop=loadCrewSprite('front',vi.fn(),failed,async()=>{throw Error('late');});
    stop(); await flush(); await flush();
    expect(failed).toHaveBeenCalledOnce();
  });
  it('rechaza imágenes corruptas o con dimensiones diferentes del original', async () => {
    const image=fakeImage(), ready=vi.fn(), failed=vi.fn();
    Object.defineProperty(image,'naturalWidth',{value:1});
    loadCrewSprite('right',ready,failed,async()=>'/bad.png',()=>image);
    await flush(); image.onload!(new Event('load'));
    expect(ready).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledOnce();
    image.onerror!(new Event('error'));
    expect(failed).toHaveBeenCalledTimes(2);
  });

  // Caché LRU entre salas (issue #158): pasar una caché explícita es opcional y no
  // cambia el comportamiento por defecto (todas las pruebas anteriores de este archivo
  // no la pasan y conservan el comportamiento de siempre, sin ningún reuso).
  it('con una caché explícita, reutiliza la imagen ya decodificada en vez de crear otra', async () => {
    const cache = new CrewLruAssetCache<HTMLImageElement>(4);
    const image = fakeImage(), ready1 = vi.fn(), failed = vi.fn(), url = vi.fn(async () => '/fixture.png');
    const stop1 = loadCrewSprite('left', ready1, failed, url, () => image, cache, 'sprite:left');
    await flush();
    image.onload!(new Event('load'));
    expect(ready1).toHaveBeenCalledExactlyOnceWith(image);
    stop1();
    // La imagen queda viva en la caché: desmontar no le quita el src, a diferencia del
    // comportamiento sin caché verificado en la primera prueba de este archivo.
    expect(image.removeAttribute).not.toHaveBeenCalled();

    const create2 = vi.fn(), ready2 = vi.fn(), url2 = vi.fn(async () => '/otra.png');
    const stop2 = loadCrewSprite('left', ready2, failed, url2, create2, cache, 'sprite:left');
    await flush();
    expect(create2).not.toHaveBeenCalled();
    expect(url2).not.toHaveBeenCalled();
    expect(ready2).toHaveBeenCalledExactlyOnceWith(image);
    stop2();
    expect(failed).not.toHaveBeenCalled();
  });

  it('con una caché explícita, una vista distinta sigue cargando de cero (claves separadas)', async () => {
    const cache = new CrewLruAssetCache<HTMLImageElement>(4);
    const imageLeft = fakeImage(), ready = vi.fn();
    loadCrewSprite('left', ready, vi.fn(), async () => '/left.png', () => imageLeft, cache, 'sprite:left');
    await flush();
    imageLeft.onload!(new Event('load'));

    const createRight = vi.fn(fakeImage), readyRight = vi.fn();
    loadCrewSprite('right', readyRight, vi.fn(), async () => '/right.png', createRight, cache, 'sprite:right');
    await flush();
    expect(createRight).toHaveBeenCalledOnce();
  });
});
