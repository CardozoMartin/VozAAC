import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GridSize, type AccessibilitySettings, type Board, type Pictogram } from '@vozaac/shared';
import { api } from '../api/client';
import { usePhrase } from '../state/usePhrase';
import { useSpeech } from '../state/useSpeech';
import { useUsageQueue } from '../state/useUsageQueue';
import { useUrgentAlert } from '../state/useUrgentAlert';
import { tremorOptionsFrom } from '../state/useTremorFilter';
import { useLayout } from '../state/useLayout';
import { PhraseBar } from '../components/PhraseBar';
import { CategoryTabs } from '../components/CategoryTabs';
import { PictogramGrid } from '../components/PictogramGrid';
import { categoryColor, paletteFor, spacing, touchTarget, typography } from '../theme';
import { Button } from '../components/ui';

interface Props {
  token: string;
  userId: string;
  profileName: string;
  /**
   * Vuelve al selector de perfiles. Ausente en el dispositivo de un chico/a
   * (Módulo 9): su perfil quedó fijado al vincularlo, y una salida que él no
   * sabe deshacer sólo lo dejaría afuera de su comunicador.
   */
  onExit?: () => void;
  /** Abre el modo terapeuta, previo PIN. Ausente si el cuidador no configuró uno. */
  onOpenEditor?: () => void;
  /**
   * Abre la bandeja de avisos (Módulo 9, paso 4). Ausente en el dispositivo
   * del chico/a: los avisos son para los adultos, y él acaba de mandarlos.
   */
  onOpenAlerts?: () => void;
}

/** Pantalla principal: el comunicador que usa el chico/a (Módulo 3). */
export function CommunicatorScreen({
  token,
  userId,
  profileName,
  onExit,
  onOpenEditor,
  onOpenAlerts,
}: Props) {
  const [board, setBoard] = useState<Board | null>(null);
  const [settings, setSettings] = useState<AccessibilitySettings | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const phrase = usePhrase();
  const { speak } = useSpeech(settings);
  const usage = useUsageQueue(token, userId);
  const alert = useUrgentAlert(token, userId);
  const palette = paletteFor(settings?.colorMode);
  const tremor = useMemo(() => tremorOptionsFrom(settings), [settings]);
  const { isCompact } = useLayout();

  useEffect(() => {
    let cancelled = false;

    async function cargar() {
      try {
        // En paralelo: la grilla necesita las dos cosas para dibujarse.
        const [boardData, settingsData] = await Promise.all([
          api.defaultBoard(token, userId),
          api.accessibility(token, userId),
        ]);
        if (cancelled) return;

        setBoard(boardData);
        setSettings(settingsData);
        setSelectedCategoryId(boardData.categories?.[0]?.id ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el tablero');
        }
      }
    }

    void cargar();
    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  const selectedCategory = useMemo(
    () => board?.categories?.find((category) => category.id === selectedCategoryId) ?? null,
    [board, selectedCategoryId],
  );

  function handleSelect(pictogram: Pictogram) {
    phrase.add(pictogram);
    usage.recordTap(pictogram.id, pictogram.text);
    // Se dice el pictograma suelto al tocarlo: es la respuesta inmediata que
    // enseña la relación entre la imagen y su palabra.
    speak(pictogram.text);

    // Un pictograma urgente además avisa a los responsables (Módulo 9, paso
    // 4). Va después de hablar y de sumarlo a la frase, no en su lugar: el
    // chico/a está comunicando algo, y que además dispare un aviso no lo
    // convierte en otra cosa.
    alert.raise(pictogram);
  }

  function handleSpeak() {
    speak(phrase.text);
    usage.recordSpoken(phrase.text);
  }

  function handleClear() {
    phrase.clear();
    usage.recordCleared();
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        {onExit && <Button label="Volver" variant="secondary" palette={palette} onPress={onExit} />}
      </View>
    );
  }

  if (!board || !settings) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.accent} testID="loading" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <PhraseBar
        pictograms={phrase.pictograms}
        palette={palette}
        onSpeak={handleSpeak}
        onClear={handleClear}
        onRemoveLast={phrase.removeLast}
      />

      <CategoryTabs
        categories={board.categories ?? []}
        selectedId={selectedCategoryId}
        palette={palette}
        colorMode={settings.colorMode}
        onSelect={setSelectedCategoryId}
      />

      <PictogramGrid
        pictograms={selectedCategory?.pictograms ?? []}
        gridSize={settings.gridSize ?? GridSize.GRID_2X3}
        color={categoryColor(selectedCategory?.color ?? palette.accent, settings.colorMode)}
        palette={palette}
        onSelect={handleSelect}
        tremor={tremor}
      />

      {/*
        El chico/a tiene que ver que su mensaje salió. Si no, no sabe si sirvió
        de algo y lo va a tocar diez veces. El cartel se limpia solo a los
        pocos segundos para no tapar la grilla.
      */}
      {alert.status !== 'idle' && (
        <View
          testID="alert-status"
          style={[
            styles.alertBanner,
            {
              backgroundColor: alert.status === 'failed' ? palette.danger : palette.accent,
            },
          ]}
        >
          <Text style={styles.alertText}>
            {alert.status === 'sending' && `Avisando "${alert.text}"…`}
            {alert.status === 'sent' && `Avisado ✓  "${alert.text}"`}
            {alert.status === 'failed' && `No se pudo avisar "${alert.text}"`}
          </Text>
        </View>
      )}

      <View style={[styles.footer, { borderColor: palette.border }]}>
        <Text style={[styles.profileName, { color: palette.textMuted }]} numberOfLines={1}>
          {profileName}
        </Text>
        <View style={styles.footerActions}>
          {onOpenAlerts && (
            <Button
              testID="button-open-alerts"
              label="Avisos"
              variant="secondary"
              palette={palette}
              onPress={onOpenAlerts}
              style={styles.footerButton}
            />
          )}
          {onOpenEditor && (
            /* En celular vertical no entran las dos etiquetas completas, y
               acortar la del editor es preferible a que se corten las dos. */
            <Button
              testID="button-open-editor"
              label={isCompact ? 'Terapeuta' : 'Modo terapeuta'}
              accessibilityLabel="Modo terapeuta"
              variant="secondary"
              palette={palette}
              onPress={onOpenEditor}
              style={styles.footerButton}
            />
          )}
          {onExit && (
            <Button
              testID="button-exit"
              label={isCompact ? 'Perfil' : 'Cambiar perfil'}
              accessibilityLabel="Cambiar de perfil"
              variant="secondary"
              palette={palette}
              onPress={onExit}
              style={styles.footerButton}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  alertBanner: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  alertText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { ...typography.subtitle, textAlign: 'center', paddingHorizontal: spacing.lg },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  profileName: { ...typography.caption, flexShrink: 1, marginRight: spacing.sm },
  footerActions: { flexDirection: 'row', gap: spacing.sm },
  // Los botones del pie son para el adulto y no tienen que competir con la
  // grilla, así que van más ajustados que un botón normal, sin bajar del
  // área táctil mínima. El contraste con la grilla lo da el tamaño, no el
  // color: un botón del pie sigue siendo legible, sólo que no llama.
  footerButton: { paddingVertical: spacing.xs, minHeight: touchTarget.minHeight },
});
