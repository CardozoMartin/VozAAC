import { act, renderHook } from '@testing-library/react-native';
import { TREMOR_FILTER } from '@vozaac/shared';
import { tremorOptionsFrom, useTremorFilter } from '../src/state/useTremorFilter';

/**
 * Tests del filtro anti-temblor (Módulo 5).
 *
 * Es el test que pide el Doc: simular toques rápidos contra toques sostenidos
 * y verificar que sólo los segundos activen el pictograma.
 *
 * Los timers van con fake timers de Jest porque el filtro se apoya en
 * setTimeout: con timers reales cada caso tardaría medio segundo y el test
 * dependería de la carga de la máquina, que es justo lo que no queremos al
 * mostrarlo corriendo en vivo.
 */
describe('useTremorFilter', () => {
  const opciones = {
    enabled: true,
    holdToConfirmMs: 300,
    debounceMs: 500,
    moveTolerancePx: 20,
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('toque rápido contra toque sostenido', () => {
    it('descarta un toque más corto que el tiempo de confirmación', () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useTremorFilter(opciones, onConfirm));

      act(() => {
        result.current.onPressIn({ x: 100, y: 100 });
        // El dedo se levanta a los 100 ms: un roce, no una selección.
        jest.advanceTimersByTime(100);
        result.current.onPressOut();
      });

      // Aunque pase el tiempo restante, el timer ya fue cancelado.
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('activa el pictograma cuando el toque se sostiene lo suficiente', () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useTremorFilter(opciones, onConfirm));

      act(() => {
        result.current.onPressIn({ x: 100, y: 100 });
        jest.advanceTimersByTime(300);
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('activa al cumplirse el hold y no al levantar el dedo', () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useTremorFilter(opciones, onConfirm));

      act(() => {
        result.current.onPressIn({ x: 100, y: 100 });
        jest.advanceTimersByTime(300);
      });

      // Ya se activó con el dedo todavía apoyado: es la respuesta inmediata
      // que enseña la relación entre el gesto y su efecto.
      expect(onConfirm).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.onPressOut();
      });

      // Soltar no vuelve a activarlo.
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('no activa antes de tiempo, ni siquiera un milisegundo antes', () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useTremorFilter(opciones, onConfirm));

      act(() => {
        result.current.onPressIn({ x: 100, y: 100 });
        jest.advanceTimersByTime(299);
      });

      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('debounce', () => {
    it('descarta el rebote: un segundo toque dentro de la ventana no activa', () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useTremorFilter(opciones, onConfirm));

      // Primer toque, sostenido y válido.
      act(() => {
        result.current.onPressIn({ x: 100, y: 100 });
        jest.advanceTimersByTime(300);
        result.current.onPressOut();
      });
      expect(onConfirm).toHaveBeenCalledTimes(1);

      // La mano rebota y vuelve a caer: sostiene lo suficiente, pero llega a
      // los 400 ms de la activación anterior, dentro de los 500 del debounce.
      act(() => {
        jest.advanceTimersByTime(100);
        result.current.onPressIn({ x: 100, y: 100 });
        jest.advanceTimersByTime(300);
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('acepta el segundo toque una vez pasada la ventana', () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useTremorFilter(opciones, onConfirm));

      act(() => {
        result.current.onPressIn({ x: 100, y: 100 });
        jest.advanceTimersByTime(300);
        result.current.onPressOut();
      });

      act(() => {
        // 600 ms desde la activación: ya pasó el debounce de 500.
        jest.advanceTimersByTime(600);
        result.current.onPressIn({ x: 100, y: 100 });
        jest.advanceTimersByTime(300);
      });

      expect(onConfirm).toHaveBeenCalledTimes(2);
    });
  });

  describe('tolerancia de movimiento', () => {
    it('cancela si el dedo se corre más de lo tolerado', () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useTremorFilter(opciones, onConfirm));

      act(() => {
        result.current.onPressIn({ x: 100, y: 100 });
        jest.advanceTimersByTime(150);
        // 50 px: más que los 20 tolerados. Es un arrastre, no un toque.
        result.current.onTouchMove({ x: 150, y: 100 });
        jest.advanceTimersByTime(300);
      });

      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('tolera el temblor pequeño sin cancelar', () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useTremorFilter(opciones, onConfirm));

      act(() => {
        result.current.onPressIn({ x: 100, y: 100 });
        jest.advanceTimersByTime(100);
        // Vibración de unos pocos píxeles: exactamente lo que el filtro existe
        // para ignorar.
        result.current.onTouchMove({ x: 105, y: 103 });
        jest.advanceTimersByTime(100);
        result.current.onTouchMove({ x: 98, y: 106 });
        jest.advanceTimersByTime(100);
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('mide la distancia desde el origen y no entre movimientos seguidos', () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useTremorFilter(opciones, onConfirm));

      act(() => {
        result.current.onPressIn({ x: 100, y: 100 });
        // Tres pasos de 15 px cada uno: ninguno supera la tolerancia por
        // separado, pero acumulados llegan a 45 px del punto inicial.
        result.current.onTouchMove({ x: 115, y: 100 });
        result.current.onTouchMove({ x: 130, y: 100 });
        result.current.onTouchMove({ x: 145, y: 100 });
        jest.advanceTimersByTime(300);
      });

      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('filtro apagado', () => {
    const sinFiltro = { ...opciones, enabled: false };

    it('activa con el toque directo, sin esperar', () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useTremorFilter(sinFiltro, onConfirm));

      act(() => {
        result.current.onPress();
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('no agrega latencia: onPressIn no arma ningún timer', () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useTremorFilter(sinFiltro, onConfirm));

      act(() => {
        result.current.onPressIn({ x: 100, y: 100 });
        jest.advanceTimersByTime(2000);
      });

      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('no aplica debounce: toques repetidos pasan todos', () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useTremorFilter(sinFiltro, onConfirm));

      act(() => {
        result.current.onPress();
        result.current.onPress();
        result.current.onPress();
      });

      // Repetir un pictograma es legítimo: "más, más, más".
      expect(onConfirm).toHaveBeenCalledTimes(3);
    });
  });

  describe('casos límite de la configuración', () => {
    it('con hold en 0 activa al apoyar, pero sigue aplicando el debounce', () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() =>
        useTremorFilter({ ...opciones, holdToConfirmMs: 0 }, onConfirm),
      );

      act(() => {
        result.current.onPressIn({ x: 100, y: 100 });
      });
      expect(onConfirm).toHaveBeenCalledTimes(1);

      // El rebote inmediato se sigue descartando: es la configuración de quien
      // tiene rebote y no temblor.
      act(() => {
        result.current.onPressOut();
        result.current.onPressIn({ x: 100, y: 100 });
      });
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('con debounce en 0 acepta toques sostenidos consecutivos', () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() =>
        useTremorFilter({ ...opciones, debounceMs: 0 }, onConfirm),
      );

      act(() => {
        result.current.onPressIn({ x: 100, y: 100 });
        jest.advanceTimersByTime(300);
        result.current.onPressOut();
        result.current.onPressIn({ x: 100, y: 100 });
        jest.advanceTimersByTime(300);
      });

      expect(onConfirm).toHaveBeenCalledTimes(2);
    });

    it('no activa un pictograma que se desmontó mientras el dedo lo sostenía', () => {
      const onConfirm = jest.fn();
      const { result, unmount } = renderHook(() => useTremorFilter(opciones, onConfirm));

      act(() => {
        result.current.onPressIn({ x: 100, y: 100 });
        jest.advanceTimersByTime(100);
      });

      // Cambio de tab, o el terapeuta borró el pictograma.
      unmount();

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('usa el callback actual y no el que existía al empezar el toque', () => {
      const viejo = jest.fn();
      const nuevo = jest.fn();
      const { result, rerender } = renderHook<
        ReturnType<typeof useTremorFilter>,
        { onConfirm: () => void }
      >(({ onConfirm }) => useTremorFilter(opciones, onConfirm), {
        initialProps: { onConfirm: viejo },
      });

      act(() => {
        result.current.onPressIn({ x: 100, y: 100 });
        jest.advanceTimersByTime(100);
      });

      // El pictograma de la celda cambió mientras el dedo sostenía.
      rerender({ onConfirm: nuevo });

      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(viejo).not.toHaveBeenCalled();
      expect(nuevo).toHaveBeenCalledTimes(1);
    });
  });
});

describe('tremorOptionsFrom', () => {
  it('cae a los valores por defecto sin configuración', () => {
    expect(tremorOptionsFrom(null)).toEqual({
      enabled: false,
      holdToConfirmMs: TREMOR_FILTER.holdToConfirmMs.default,
      debounceMs: TREMOR_FILTER.debounceMs.default,
      moveTolerancePx: TREMOR_FILTER.moveTolerancePx.default,
    });
  });

  it('respeta un 0 configurado en vez de tomarlo por ausente', () => {
    const opciones = tremorOptionsFrom({
      tremorFilterEnabled: true,
      holdToConfirmMs: 0,
      debounceMs: 0,
      moveTolerancePx: 0,
    });

    expect(opciones.holdToConfirmMs).toBe(0);
    expect(opciones.debounceMs).toBe(0);
    expect(opciones.moveTolerancePx).toBe(0);
  });
});
