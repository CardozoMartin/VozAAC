import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ArasaacPictogram } from '@vozaac/shared';

/** Forma de lo que devuelve el banco; sólo se declara lo que se usa. */
interface ArasaacSearchResult {
  _id: number;
  keywords?: { keyword?: string }[];
}

/** Tamaño de imagen que sirve el CDN. 300px entra bien en una celda de tablet. */
const IMAGE_SIZE = 300;

/** Si el banco no responde en este tiempo, se corta y se avisa. */
const TIMEOUT_MS = 8000;

/**
 * Cliente del banco de pictogramas ARASAAC (Módulo 4).
 *
 * Se consulta desde el servidor y no desde la app para no acoplar el móvil a
 * un servicio externo y poder cachear o reemplazar el banco más adelante sin
 * tocar el cliente.
 *
 * Las imágenes se referencian por su URL en el CDN de ARASAAC, no se copian:
 * son de uso libre con atribución y así el tablero no duplica miles de PNG.
 */
@Injectable()
export class ArasaacService {
  private readonly logger = new Logger(ArasaacService.name);
  private readonly apiUrl: string;

  constructor(config: ConfigService) {
    this.apiUrl = config.get<string>('ARASAAC_API_URL', 'https://api.arasaac.org/api');
  }

  /**
   * Busca pictogramas por palabra.
   *
   * Un término sin resultados devuelve lista vacía, que no es un error: el
   * editor muestra "no se encontró nada" y el terapeuta prueba otra palabra.
   */
  async search(term: string, locale = 'es'): Promise<ArasaacPictogram[]> {
    const query = term.trim();
    if (!query) return [];

    const url = `${this.apiUrl}/pictograms/${locale}/search/${encodeURIComponent(query)}`;

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      // El banco está caído o sin red: es un 503, no un error del terapeuta.
      this.logger.warn(`No se pudo consultar ARASAAC: ${String(error)}`);
      throw new ServiceUnavailableException('El banco de pictogramas no está disponible');
    }

    if (response.status === 404) {
      // ARASAAC responde 404 para algunas búsquedas sin coincidencias.
      return [];
    }

    if (!response.ok) {
      this.logger.warn(`ARASAAC respondió ${response.status} para "${query}"`);
      throw new ServiceUnavailableException('El banco de pictogramas no está disponible');
    }

    const results = (await response.json()) as ArasaacSearchResult[];
    return results.map((result) => ({
      id: result._id,
      // La primera keyword es la más representativa; si faltara, se usa el
      // término buscado para que la celda nunca quede sin texto.
      text: result.keywords?.[0]?.keyword ?? query,
      imageUrl: this.imageUrl(result._id),
    }));
  }

  /** URL de la imagen en el CDN de ARASAAC. */
  imageUrl(id: number): string {
    return `https://static.arasaac.org/pictograms/${id}/${id}_${IMAGE_SIZE}.png`;
  }
}
