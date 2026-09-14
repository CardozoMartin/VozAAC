import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ArasaacService } from './arasaac.service';

/**
 * El banco es un servicio externo, así que fetch se mockea: los tests no deben
 * fallar porque ARASAAC esté caído o porque no haya red.
 */
describe('ArasaacService', () => {
  let service: ArasaacService;
  const fetchMock = jest.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
    service = new ArasaacService({
      get: (_key: string, fallback: string) => fallback,
    } as unknown as ConfigService);
  });

  function respuesta(body: unknown, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
  }

  it('mapea los resultados del banco al formato de la app', async () => {
    fetchMock.mockResolvedValue(
      respuesta([{ _id: 2248, keywords: [{ keyword: 'agua' }, { keyword: 'H2O' }] }]),
    );

    const resultados = await service.search('agua');

    expect(resultados).toEqual([
      {
        id: 2248,
        text: 'agua',
        imageUrl: 'https://static.arasaac.org/pictograms/2248/2248_300.png',
      },
    ]);
  });

  it('usa el término buscado cuando el resultado no trae keywords', async () => {
    fetchMock.mockResolvedValue(respuesta([{ _id: 99, keywords: [] }]));

    const [resultado] = await service.search('pelota');

    // La celda nunca debe quedar sin texto.
    expect(resultado.text).toBe('pelota');
  });

  it('devuelve vacío sin llamar al banco cuando el término está en blanco', async () => {
    await expect(service.search('   ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('devuelve vacío cuando no hay coincidencias', async () => {
    fetchMock.mockResolvedValue(respuesta([]));

    await expect(service.search('xyzqwerty')).resolves.toEqual([]);
  });

  it('trata el 404 del banco como búsqueda sin resultados', async () => {
    fetchMock.mockResolvedValue(respuesta(null, 404));

    // No es un error del terapeuta: simplemente no encontró nada.
    await expect(service.search('inexistente')).resolves.toEqual([]);
  });

  it('escapa el término en la URL', async () => {
    fetchMock.mockResolvedValue(respuesta([]));

    await service.search('feliz cumpleaños');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('feliz%20cumplea%C3%B1os'),
      expect.anything(),
    );
  });

  it('avisa que el banco no está disponible si la red falla', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.search('agua')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('avisa que el banco no está disponible ante un error del servidor', async () => {
    fetchMock.mockResolvedValue(respuesta(null, 500));

    await expect(service.search('agua')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('arma la URL de imagen a partir del id', () => {
    expect(service.imageUrl(32464)).toBe(
      'https://static.arasaac.org/pictograms/32464/32464_300.png',
    );
  });
});
