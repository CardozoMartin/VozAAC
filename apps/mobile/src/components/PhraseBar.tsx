import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Pictogram } from '@vozaac/shared';
import type { Palette } from '../theme';
import { spacing } from '../theme';

interface Props {
  pictograms: Pictogram[];
  palette: Palette;
  onSpeak: () => void;
  onClear: () => void;
  onRemoveLast: () => void;
}

/**
 * Barra de frase: lo que se va armando arriba de la grilla (Módulo 3).
 *
 * Muestra las imágenes y no sólo el texto porque quien usa el comunicador
 * generalmente no lee: la frase escrita no le devolvería nada.
 */
export function PhraseBar({ pictograms, palette, onSpeak, onClear, onRemoveLast }: Props) {
  const isEmpty = pictograms.length === 0;

  return (
    <View
      style={[styles.container, { backgroundColor: palette.surface, borderColor: palette.border }]}
    >
      <ScrollView
        horizontal
        style={styles.strip}
        contentContainerStyle={styles.stripContent}
        showsHorizontalScrollIndicator={false}
        testID="phrase-strip"
      >
        {isEmpty ? (
          <Text style={[styles.placeholder, { color: palette.textMuted }]}>
            Tocá los pictogramas para armar la frase
          </Text>
        ) : (
          pictograms.map((pictogram, index) => (
            // La clave lleva el índice porque un mismo pictograma puede repetirse.
            <View key={`${pictogram.id}-${index}`} style={styles.chip}>
              <Image
                source={{ uri: pictogram.imageUrl }}
                style={styles.chipImage}
                resizeMode="contain"
                accessible={false}
              />
              <Text style={[styles.chipText, { color: palette.text }]} numberOfLines={1}>
                {pictogram.text}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          testID="button-speak"
          accessibilityRole="button"
          accessibilityLabel="Hablar"
          accessibilityState={{ disabled: isEmpty }}
          disabled={isEmpty}
          onPress={onSpeak}
          style={[styles.button, { backgroundColor: palette.accent, opacity: isEmpty ? 0.4 : 1 }]}
        >
          <Text style={styles.buttonText}>Hablar</Text>
        </Pressable>

        <Pressable
          testID="button-remove-last"
          accessibilityRole="button"
          accessibilityLabel="Borrar el último"
          accessibilityState={{ disabled: isEmpty }}
          disabled={isEmpty}
          onPress={onRemoveLast}
          style={[styles.buttonSmall, { borderColor: palette.border, opacity: isEmpty ? 0.4 : 1 }]}
        >
          <Text style={[styles.buttonSmallText, { color: palette.text }]}>←</Text>
        </Pressable>

        <Pressable
          testID="button-clear"
          accessibilityRole="button"
          accessibilityLabel="Limpiar la frase"
          accessibilityState={{ disabled: isEmpty }}
          disabled={isEmpty}
          onPress={onClear}
          style={[styles.buttonSmall, { borderColor: palette.border, opacity: isEmpty ? 0.4 : 1 }]}
        >
          <Text style={[styles.buttonSmallText, { color: palette.danger }]}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 110,
  },
  strip: { flex: 1 },
  stripContent: { alignItems: 'center', gap: spacing.sm },
  placeholder: { fontSize: 16, paddingHorizontal: spacing.sm },
  chip: { width: 78, alignItems: 'center' },
  chipImage: { width: 60, height: 60 },
  chipText: { fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: spacing.sm },
  button: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 12 },
  buttonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  buttonSmall: {
    width: 56,
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmallText: { fontSize: 24, fontWeight: '700' },
});
