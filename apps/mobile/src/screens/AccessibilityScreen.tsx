import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  ColorMode,
  GRID_CELL_COUNT,
  GridSize,
  SPEECH_PITCH,
  SPEECH_RATE,
  TREMOR_FILTER,
  type AccessibilitySettings,
} from '@vozaac/shared';
import { api } from '../api/client';
import { useSpeech } from '../state/useSpeech';
import { gridDimensionsFor, useLayout } from '../state/useLayout';
import { paletteFor, radius, spacing, touchTarget, typography } from '../theme';
import { Button } from '../components/ui';

interface Props {
  token: string;
  userId: string;
  onExit: () => void;
}

const COLOR_LABELS: Record<ColorMode, string> = {
  [ColorMode.STANDARD]: 'Estándar',
  [ColorMode.LOW_STIMULUS]: 'Bajo estímulo',
  [ColorMode.HIGH_CONTRAST]: 'Alto contraste',
};

/** Redondea a un decimal: 0.1 + 0.2 daría 0.30000000000000004 en el label. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Ajustes de accesibilidad, dentro del modo terapeuta (Módulo 5).
 *
 * Cada control guarda apenas se toca, sin botón de "guardar". Es lo contrario
 * al editor de pictogramas del Módulo 4, y a propósito: acá el terapeuta
 * necesita ver el efecto —la voz más lenta, la grilla más grande— para decidir
 * si el valor sirve, y eso pide realimentación inmediata. En el editor el
 * borrador protege al chico/a de ver cambiar el tablero mientras se comunica;
 * acá el chico/a no está mirando esta pantalla.
 *
 * Los +/− reemplazan a un slider porque un slider pediría una dependencia
 * nativa más y acá alcanza con pasos discretos.
 */
export function AccessibilityScreen({ token, userId, onExit }: Props) {
  const [settings, setSettings] = useState<AccessibilitySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const palette = paletteFor(settings?.colorMode);
  const { speak } = useSpeech(settings);
  const { isLandscape } = useLayout();

  useEffect(() => {
    let cancelled = false;

    api
      .accessibility(token, userId)
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la configuración');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  /**
   * Aplica el cambio en pantalla y lo manda al servidor.
   *
   * Optimista: el control se mueve al instante y no cuando responde la API.
   * Si falla se avisa, pero no se revierte —el valor que ve el terapeuta es el
   * que la app ya está usando en memoria, y volverlo atrás sería más confuso
   * que el mensaje de error.
   */
  async function apply(changes: Partial<AccessibilitySettings>) {
    if (!settings) return;

    setSettings({ ...settings, ...changes });
    setSaving(true);
    setError(null);
    try {
      const saved = await api.updateAccessibility(token, userId, changes);
      setSettings(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio');
    } finally {
      setSaving(false);
    }
  }

  function renderStepper(
    label: string,
    testID: string,
    value: number,
    unit: string,
    step: number,
    min: number,
    max: number,
    onChange: (next: number) => void,
  ) {
    return (
      <View style={styles.stepperRow}>
        <Text style={[styles.stepperLabel, { color: palette.text }]}>{label}</Text>
        <View style={styles.stepperControls}>
          <Pressable
            testID={`${testID}-menos`}
            accessibilityRole="button"
            accessibilityLabel={`Disminuir ${label}`}
            disabled={value <= min}
            onPress={() => onChange(clamp(round(value - step), min, max))}
            style={[
              styles.stepButton,
              { borderColor: palette.border, opacity: value <= min ? 0.4 : 1 },
            ]}
          >
            <Text style={[styles.stepButtonText, { color: palette.text }]}>−</Text>
          </Pressable>

          <Text testID={`${testID}-valor`} style={[styles.stepperValue, { color: palette.text }]}>
            {value}
            {unit}
          </Text>

          <Pressable
            testID={`${testID}-mas`}
            accessibilityRole="button"
            accessibilityLabel={`Aumentar ${label}`}
            disabled={value >= max}
            onPress={() => onChange(clamp(round(value + step), min, max))}
            style={[
              styles.stepButton,
              { borderColor: palette.border, opacity: value >= max ? 0.4 : 1 },
            ]}
          >
            <Text style={[styles.stepButtonText, { color: palette.text }]}>+</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (error && !settings) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
        <Button
          testID="button-volver"
          label="Volver"
          variant="secondary"
          palette={palette}
          onPress={onExit}
        />
      </View>
    );
  }

  if (!settings) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.accent} testID="loading-accessibility" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.container}
      testID="accessibility-screen"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Accesibilidad</Text>
        {saving && <ActivityIndicator color={palette.accent} testID="saving" />}
      </View>

      {error && <Text style={[styles.inlineError, { color: palette.danger }]}>{error}</Text>}

      {/* --- Grilla --- */}
      <Text style={[styles.section, { color: palette.text }]}>Tamaño de la cuadrícula</Text>
      <Text style={[styles.hint, { color: palette.textMuted }]}>
        Menos celdas significa celdas más grandes, y menor exigencia motriz. La disposición se
        acomoda sola al rotar el dispositivo; la cantidad de celdas no cambia.
      </Text>
      <View style={styles.options}>
        {Object.values(GridSize).map((size) => {
          const active = settings.gridSize === size;
          // La disposición que va a tener acá y ahora: mostrar la nominal
          // haría que el botón no coincida con lo que se ve al volver.
          const { columns, rows } = gridDimensionsFor(size, isLandscape);
          return (
            <Pressable
              key={size}
              testID={`grid-${size}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Cuadrícula de ${columns} por ${rows}`}
              onPress={() => void apply({ gridSize: size })}
              style={[
                styles.option,
                {
                  borderColor: active ? palette.accent : palette.border,
                  backgroundColor: active ? palette.accent : palette.surface,
                  borderWidth: active ? 3 : 1,
                },
              ]}
            >
              <Text style={{ color: active ? '#FFFFFF' : palette.text, fontWeight: '600' }}>
                {columns} × {rows}
              </Text>
              <Text style={{ color: active ? '#FFFFFF' : palette.textMuted, fontSize: 12 }}>
                {GRID_CELL_COUNT[size]} celdas
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* --- Color --- */}
      <Text style={[styles.section, { color: palette.text }]}>Paleta de color</Text>
      <Text style={[styles.hint, { color: palette.textMuted }]}>
        Bajo estímulo apaga la saturación, para hipersensibilidad visual; alto contraste hace lo
        contrario, para baja visión.
      </Text>
      <View style={styles.options}>
        {Object.values(ColorMode).map((mode) => {
          const active = settings.colorMode === mode;
          return (
            <Pressable
              key={mode}
              testID={`color-${mode}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={COLOR_LABELS[mode]}
              onPress={() => void apply({ colorMode: mode })}
              style={[
                styles.option,
                {
                  borderColor: active ? palette.accent : palette.border,
                  backgroundColor: active ? palette.accent : palette.surface,
                  borderWidth: active ? 3 : 1,
                },
              ]}
            >
              <Text style={{ color: active ? '#FFFFFF' : palette.text, fontWeight: '600' }}>
                {COLOR_LABELS[mode]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* --- Filtro anti-temblor --- */}
      <Text style={[styles.section, { color: palette.text }]}>Filtro anti-temblor</Text>
      <Text style={[styles.hint, { color: palette.textMuted }]}>
        Pide que el dedo se mantenga sobre el pictograma antes de activarlo, y descarta los toques
        que rebotan. Para temblor, espasticidad o movimientos involuntarios.
      </Text>

      <View style={[styles.switchRow, { borderColor: palette.border }]}>
        <Text style={[styles.stepperLabel, { color: palette.text }]}>Activar el filtro</Text>
        <Switch
          testID="switch-tremor"
          accessibilityLabel="Activar el filtro anti-temblor"
          value={settings.tremorFilterEnabled}
          onValueChange={(value) => void apply({ tremorFilterEnabled: value })}
          trackColor={{ true: palette.accent, false: palette.border }}
        />
      </View>

      {settings.tremorFilterEnabled && (
        <View testID="tremor-controls">
          {renderStepper(
            'Sostener para confirmar',
            'hold',
            settings.holdToConfirmMs,
            ' ms',
            50,
            TREMOR_FILTER.holdToConfirmMs.min,
            TREMOR_FILTER.holdToConfirmMs.max,
            (next) => void apply({ holdToConfirmMs: next }),
          )}
          {renderStepper(
            'Ignorar repeticiones durante',
            'debounce',
            settings.debounceMs,
            ' ms',
            50,
            TREMOR_FILTER.debounceMs.min,
            TREMOR_FILTER.debounceMs.max,
            (next) => void apply({ debounceMs: next }),
          )}
          {renderStepper(
            'Movimiento tolerado',
            'tolerancia',
            settings.moveTolerancePx,
            ' px',
            5,
            TREMOR_FILTER.moveTolerancePx.min,
            TREMOR_FILTER.moveTolerancePx.max,
            (next) => void apply({ moveTolerancePx: next }),
          )}
        </View>
      )}

      {/* --- Voz --- */}
      <Text style={[styles.section, { color: palette.text }]}>Voz</Text>
      <Text style={[styles.hint, { color: palette.textMuted }]}>
        Probá el resultado antes de dejarlo: una voz demasiado rápida se vuelve difícil de seguir.
      </Text>

      {renderStepper(
        'Velocidad',
        'velocidad',
        round(settings.speechRate),
        '×',
        SPEECH_RATE.step,
        SPEECH_RATE.min,
        SPEECH_RATE.max,
        (next) => void apply({ speechRate: next }),
      )}
      {renderStepper(
        'Tono',
        'tono',
        round(settings.speechPitch),
        '×',
        SPEECH_PITCH.step,
        SPEECH_PITCH.min,
        SPEECH_PITCH.max,
        (next) => void apply({ speechPitch: next }),
      )}

      <Button
        testID="button-probar-voz"
        label="Probar la voz"
        palette={palette}
        onPress={() => speak('Hola, quiero jugar')}
      />

      <Button
        testID="button-volver"
        label="Volver"
        variant="secondary"
        palette={palette}
        onPress={onExit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: typography.title,
  section: { ...typography.subtitle, marginTop: spacing.md },
  hint: { ...typography.caption, lineHeight: 18 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  // Las opciones de grilla y paleta no son Buttons: se anuncian como radio
  // con su estado seleccionado, que es lo que dice cuál está activa.
  option: {
    borderRadius: radius.buttonSmall,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 96,
    minHeight: touchTarget.minHeight,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.buttonSmall,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  stepperLabel: { ...typography.body, flexShrink: 1 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // El stepper es un cuadrado de 44: lo usa un adulto, muchas veces con el
  // chico/a encima y sin poder mirar con atención.
  stepButton: {
    borderWidth: 1,
    borderRadius: radius.buttonSmall,
    width: touchTarget.minHeight,
    height: touchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: { fontSize: 22, fontWeight: '700' },
  stepperValue: { ...typography.pictogram, minWidth: 72, textAlign: 'center' },
  inlineError: typography.caption,
  error: { ...typography.subtitle, textAlign: 'center', paddingHorizontal: spacing.lg },
});
