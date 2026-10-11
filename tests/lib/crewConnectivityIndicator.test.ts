import { describe, expect, it } from 'vitest';
import type { RealtimeStatus } from '../../src/integrations/realtimeClient';
import {
  crewConnectivityIconFromStatus,
  crewConnectivityIconSpec,
  crewConnectivityVisualState,
} from '../../src/crew/crewConnectivityIndicator';

// Los 7 valores reales de RealtimeStatus (src/integrations/realtimeClient.ts), nunca inventados
// por este módulo. Si ese tipo gana un valor nuevo, esta lista debe actualizarse a mano para
// que la prueba exhaustiva de abajo lo note.
const ALL_REAL_STATUSES: readonly RealtimeStatus[] = [
  'connecting', 'connected', 'reconnecting', 'disconnected', 'error', 'closed', 'resyncing',
];

describe('crewConnectivityVisualState: mapeo honesto de RealtimeStatus real (#145 sub-alcance Wi-Fi, ver #273)', () => {
  it('mapea "connected" a "online"', () => {
    expect(crewConnectivityVisualState('connected')).toBe('online');
  });

  it('mapea las fases transitorias reales a "connecting", nunca a "online"', () => {
    expect(crewConnectivityVisualState('connecting')).toBe('connecting');
    expect(crewConnectivityVisualState('reconnecting')).toBe('connecting');
    expect(crewConnectivityVisualState('resyncing')).toBe('connecting');
  });

  it('mapea los estados reales sin conexión utilizable a "offline"', () => {
    expect(crewConnectivityVisualState('disconnected')).toBe('offline');
    expect(crewConnectivityVisualState('error')).toBe('offline');
    expect(crewConnectivityVisualState('closed')).toBe('offline');
  });

  it('nunca reporta "online" salvo que el status real sea exactamente "connected"', () => {
    for (const status of ALL_REAL_STATUSES) {
      if (status === 'connected') continue;
      expect(crewConnectivityVisualState(status)).not.toBe('online');
    }
  });

  it('cubre los 7 valores reales de RealtimeStatus sin dejar ninguno sin mapear', () => {
    for (const status of ALL_REAL_STATUSES) {
      expect(['online', 'connecting', 'offline']).toContain(crewConnectivityVisualState(status));
    }
  });

  it('ante un valor futuro no reconocido todavía, cae al lado seguro ("offline"), nunca inventa "online"', () => {
    const futureStatus = 'a-future-status-not-yet-real' as unknown as RealtimeStatus;
    expect(crewConnectivityVisualState(futureStatus)).toBe('offline');
  });
});

describe('crewConnectivityIconSpec: qué icono real del banco dibujar por estado visual', () => {
  it('"online" usa el icono wifi, sin pulso (conexión estable)', () => {
    expect(crewConnectivityIconSpec('online')).toEqual({ icon: 'wifi', pulse: false });
  });

  it('"connecting" usa el icono wifi, con pulso (fase transitoria real, nunca "conectado")', () => {
    expect(crewConnectivityIconSpec('connecting')).toEqual({ icon: 'wifi', pulse: true });
  });

  it('"offline" usa el icono de alerta, sin pulso', () => {
    expect(crewConnectivityIconSpec('offline')).toEqual({ icon: 'alert', pulse: false });
  });
});

describe('crewConnectivityIconFromStatus: atajo directo desde el RealtimeStatus real', () => {
  it('compone crewConnectivityVisualState + crewConnectivityIconSpec sin estado intermedio nuevo', () => {
    for (const status of ALL_REAL_STATUSES) {
      const expected = crewConnectivityIconSpec(crewConnectivityVisualState(status));
      expect(crewConnectivityIconFromStatus(status)).toEqual(expected);
    }
  });

  it('nunca produce {icon: "wifi", pulse: false} (online) para un status real que no es "connected"', () => {
    for (const status of ALL_REAL_STATUSES) {
      if (status === 'connected') continue;
      expect(crewConnectivityIconFromStatus(status)).not.toEqual({ icon: 'wifi', pulse: false });
    }
  });
});
