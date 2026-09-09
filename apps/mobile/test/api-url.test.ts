/**
 * Resolución de la URL de la API.
 *
 * Lo que se protege acá es que probar desde un celular real funcione sin
 * editar nada: `localhost` en el teléfono es el propio teléfono, así que
 * apuntar ahí es el error que deja la app "sin conexión" sin explicar por qué.
 *
 * El módulo calcula API_URL al importarse, así que cada caso resetea el
 * registro de módulos y vuelve a requerirlo con otro mock de expo-constants.
 */
describe('API_URL', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  /** Carga el cliente con la configuración de Expo que se le indique. */
  function loadWith(constants: Record<string, unknown>): string {
    jest.doMock('expo-constants', () => ({ __esModule: true, default: constants }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('../src/api/client') as { API_URL: string }).API_URL;
  }

  it('deriva la IP de la máquina que sirve el bundle de Expo', () => {
    const url = loadWith({ expoConfig: { hostUri: '192.168.1.7:8081', extra: {} } });

    expect(url).toBe('http://192.168.1.7:3010/api');
  });

  it('acepta el debuggerHost de las versiones que lo exponen ahí', () => {
    const url = loadWith({
      expoConfig: { extra: {} },
      expoGoConfig: { debuggerHost: '10.0.0.42:8081' },
    });

    expect(url).toBe('http://10.0.0.42:3010/api');
  });

  it('respeta apiUrl si está configurada, para apuntar a un backend o un túnel', () => {
    const url = loadWith({
      expoConfig: { hostUri: '192.168.1.7:8081', extra: { apiUrl: 'https://api.vozaac.app/api' } },
    });

    // La explícita gana sobre la derivada: es la forma de probar contra algo
    // que no sea la máquina de desarrollo.
    expect(url).toBe('https://api.vozaac.app/api');
  });

  it('ignora un hostUri en localhost en vez de apuntar el teléfono a sí mismo', () => {
    const url = loadWith({ expoConfig: { hostUri: 'localhost:8081', extra: {} } });

    expect(url).toBe('http://localhost:3010/api');
  });

  it('cae a localhost cuando no hay servidor de Expo, como en un build', () => {
    const url = loadWith({ expoConfig: { extra: {} } });

    expect(url).toBe('http://localhost:3010/api');
  });

  it('no se rompe si no hay expoConfig', () => {
    const url = loadWith({});

    expect(url).toBe('http://localhost:3010/api');
  });
});
