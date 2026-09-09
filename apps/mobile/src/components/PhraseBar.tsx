import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Pictogram } from '@vozaac/shared';
import type { Palette } from '../theme';
import { spacing } from '../theme';
import { useLayout } from '../state/useLayout';

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
 *
 * En un celular vertical la fila única no entra: los pictogramas quedarían
 * espiando por una rendija. Ahí la barra se parte en dos —la frase arriba, los
 * botones abajo— en vez de encoger todo, porque "Hablar" es el botón que más
 * se toca y no puede achicarse.
 */
export function PhraseBar({ pictograms, palette, onSpeak, onClear, onRemoveLast }: Props) {
  const isEmpty = pictograms.length === 0;
  const { isCompact } = useLayout();

  return (
    <View
      style={[
        styles.container,
        isCompact && styles.containerCompact,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
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

      <View style={[styles.actions, isCompact && styles.actionsCompact]}>
        <Pressable
          testID="button-speak"
          accessibilityRole="button"
          accessibilityLabel="Hablar"
          accessibilityState={{ disabled: isEmpty }}
          disabled={isEmpty}
          onPress={onSpeak}
          style={[
            styles.button,
            isCompact && styles.buttonCompact,
            { backgroundColor: palette.accent, opacity: isEmpty ? 0.4 : 1 },
          ]}
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
  // En celular vertical la barra se apila y deja la fila entera a la frase.
  containerCompact: { flexDirection: 'column', alignItems: 'stretch', minHeight: 150 },
  strip: { flex: 1 },
  stripContent: { alignItems: 'center', gap: spacing.sm },
  placeholder: { fontSize: 16, paddingHorizontal: spacing.sm },
  chip: { width: 78, alignItems: 'center' },
  chipImage: { width: 60, height: 60 },
  chipText: { fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: spacing.sm },
  actionsCompact: { marginLeft: 0, marginTop: spacing.sm, justifyContent: 'space-between' },
  button: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 12 },
  // Apilada, "Hablar" se lleva el ancho sobrante: es el botón que más se toca.
  buttonCompact: { flex: 1, alignItems: 'center' },
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
