import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GridSize, type AccessibilitySettings, type Board, type Pictogram } from '@vozaac/shared';
import { api } from '../api/client';
import { usePhrase } from '../state/usePhrase';
import { useSpeech } from '../state/useSpeech';
import { useUsageQueue } from '../state/useUsageQueue';
import { PhraseBar } from '../components/PhraseBar';
import { CategoryTabs } from '../components/CategoryTabs';
import { PictogramGrid } from '../components/PictogramGrid';
import { categoryColor, paletteFor, spacing } from '../theme';

interface Props {
  token: string;
  userId: string;
  profileName: string;
  onExit: () => void;
}

/** Pantalla principal: el comunicador que usa el chico/a (Módulo 3). */
export function CommunicatorScreen({ token, userId, profileName, onExit }: Props) {
  const [board, setBoard] = useState<Board | null>(null);
  const [settings, setSettings] = useState<AccessibilitySettings | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const phrase = usePhrase();
  const { speak } = useSpeech(settings);
  const usage = useUsageQueue(token, userId);
  const palette = paletteFor(settings?.colorMode);

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
        <Pressable onPress={onExit} style={[styles.exitButton, { borderColor: palette.border }]}>
          <Text style={{ color: palette.text }}>Volver</Text>
        </Pressable>
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
      />

      <View style={[styles.footer, { borderColor: palette.border }]}>
        <Text style={[styles.profileName, { color: palette.textMuted }]}>{profileName}</Text>
        <Pressable
          testID="button-exit"
          accessibilityRole="button"
          accessibilityLabel="Cambiar de perfil"
          onPress={onExit}
          style={[styles.exitButton, { borderColor: palette.border }]}
        >
          <Text style={{ color: palette.textMuted }}>Cambiar perfil</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { fontSize: 18, textAlign: 'center', paddingHorizontal: spacing.lg },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  profileName: { fontSize: 14 },
  exitButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
