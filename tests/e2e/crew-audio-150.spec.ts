import { expect, test } from '@playwright/test';

/**
 * Brecha real de la matriz QA de #159: el motor de audio propio de Crew (#150,
 * `crewAudioEngine.ts`/`useCrewAudio.ts`, botón Play/Pause ya cableado en
 * `CrewStage.tsx`) solo tenía pruebas unitarias con un `AudioContext` simulado
 * en jsdom (`tests/lib/crewAudioEngine.test.ts`, `tests/lib/useCrewAudio.test.tsx`).
 * Ninguna prueba ejercitaba el Web Audio API real de un navegador, el gesto de
 * usuario real que exige la política de autoplay, el no-autoplay al cambiar de
 * sala/modo, ni la liberación real del `AudioContext` al salir de Crew. La
 * matriz de #159 nombra explícitamente "teclados/audio" y "limpieza de
 * listeners/canvas al salir de Crew" como escenarios a cubrir.
 */

test('audio de Crew: sin pista fuera de descanso, requiere gesto real y nunca se reanuda sola al cambiar de sala (#150)', async ({ page }) => {
  await page.goto('/?visualMode=crew&crewRoom=development');
  await page.getByRole('button', { name: 'Reset Crew preferences', exact: true }).click();

  const summary = page.getByText('Crew accessibility and audio', { exact: true });
  await summary.focus();
  await page.keyboard.press('Enter');

  const toggle = page.getByTestId('crew-audio-toggle');
  const status = page.getByTestId('crew-audio-status');

  // Development no tiene pista propia (`CREW_ROOM_MUSIC`): el botón queda
  // deshabilitado y lo informa, sin que el estado sea "unsupported" (Chromium
  // sí soporta Web Audio real).
  await expect(toggle).toBeDisabled();
  await expect(status).toHaveText('This office has no music of its own.');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  // La sala de descanso es la única con pista configurada: cambiar a ella
  // habilita el botón, pero no arranca sonido por sí sola (sin gesto, sigue
  // en pausa).
  await page.locator('#crew-room').selectOption('lounge');
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(status).toHaveText('Paused. Never plays without pressing Play.');

  // Gesto real de teclado (Enter con foco en el botón): Playwright despacha un
  // evento de entrada real, el único que la política de autoplay de Chromium
  // acepta para iniciar un `AudioContext`. Esto es exactamente lo que ninguna
  // prueba unitaria con `AudioContext` simulado puede verificar.
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(status).toHaveText('Playing.');
  await expect(toggle).toContainText('Pause room audio');

  // Cambiar a una sala sin música detiene la pista sola (nunca sigue sonando
  // de fondo) y el botón vuelve a quedar deshabilitado, sin que el host tenga
  // que llamar pause() explícitamente.
  await page.locator('#crew-room').selectOption('ceo');
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  // Volver a la sala de descanso NO reanuda sola: exige un nuevo gesto, igual
  // que la primera vez.
  await page.locator('#crew-room').selectOption('lounge');
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(status).toHaveText('Paused. Never plays without pressing Play.');
});

test('audio de Crew libera su AudioContext real al salir de Crew y no deja ninguno abierto entre montajes (#150)', async ({ page }) => {
  // Cuenta cada `close()` real sobre el prototipo compartido de `AudioContext`,
  // sin sustituir el constructor: el motor usa `AudioContext` real de Chromium,
  // así que esta es la única forma de confirmar que `dispose()` realmente
  // suelta el contexto, no solo que deja de sonar.
  await page.addInitScript(() => {
    const proto = window.AudioContext.prototype;
    const originalClose = proto.close;
    let closed = 0;
    proto.close = function (this: AudioContext, ...args: Parameters<typeof originalClose>) {
      closed += 1;
      return originalClose.apply(this, args);
    };
    Object.defineProperty(window, '__crewAudioContextClosedCount', { get: () => closed });
  });

  const closedCount = () => page.evaluate(() => (window as unknown as { __crewAudioContextClosedCount: number }).__crewAudioContextClosedCount);

  await page.goto('/?visualMode=crew&crewRoom=lounge');
  const summary = page.getByText('Crew accessibility and audio', { exact: true });
  await summary.focus();
  await page.keyboard.press('Enter');
  const toggle = page.getByTestId('crew-audio-toggle');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await closedCount()).toBe(0);

  // Salir de Crew desmonta `CrewStage`: el efecto de limpieza de `useCrewAudio`
  // debe llamar `dispose()`, que a su vez cierra el `AudioContext` real.
  await page.getByRole('button', { name: 'Cartoon', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect.poll(closedCount).toBe(1);

  // Volver a Crew monta una instancia nueva del motor, en reposo (sin
  // autoplay) aunque la sala guardada (#171) siga siendo la de descanso. El
  // nuevo montaje de `CrewStage` vuelve a colapsar el `<details>` (estado
  // nativo del DOM, no persistido), así que hay que reabrirlo de nuevo.
  await page.getByRole('button', { name: 'Crew · Beta', exact: true }).click();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  // Repetir el ciclo confirma que cada montaje libera su propio contexto, sin
  // acumular contextos abiertos entre alternancias repetidas de modo.
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Cartoon', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect.poll(closedCount).toBe(2);
});
