import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ArasaacPictogram } from '@vozaac/shared';
import { api } from '../api/client';
import { radius, spacing, typography, type Palette } from '../theme';
import { Button } from './ui';

interface Props {
  token: string;
  palette: Palette;
  onPick: (pictogram: ArasaacPictogram) => void;
}

/**
 * Buscador del banco ARASAAC (Módulo 4).
 *
 * La búsqueda se dispara al enviar y no mientras se tipea: cada tecla sería un
 * viaje a un servicio externo, y el terapeuta escribe la palabra completa.
 */
export function ArasaacPicker({ token, palette, onPick }: Props) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<ArasaacPictogram[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await api.searchArasaac(token, term));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo buscar');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          testID="input-arasaac-search"
          accessibilityLabel="Buscar en ARASAAC"
          placeholder="Buscar un pictograma"
          placeholderTextColor={palette.textMuted}
          value={term}
          onChangeText={setTerm}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
        />
        <Button
          testID="button-arasaac-search"
          label="Buscar"
          palette={palette}
          onPress={handleSearch}
        />
      </View>

      {loading && <ActivityIndicator testID="arasaac-loading" color={palette.accent} />}

      {error && (
        <Text testID="arasaac-error" style={[styles.message, { color: palette.danger }]}>
          {error}
        </Text>
      )}

      {results?.length === 0 && (
        <Text testID="arasaac-empty" style={[styles.message, { color: palette.textMuted }]}>
          No se encontraron pictogramas para "{term}"
        </Text>
      )}

      {results && results.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.results}>
            {results.map((pictogram) => (
              <Pressable
                key={pictogram.id}
                testID={`arasaac-${pictogram.id}`}
                accessibilityRole="button"
                accessibilityLabel={pictogram.text}
                onPress={() => onPick(pictogram)}
                style={[styles.result, { borderColor: palette.border }]}
              >
                <Image
                  source={{ uri: pictogram.imageUrl }}
                  style={styles.image}
                  resizeMode="contain"
                  accessible={false}
                />
                <Text style={[styles.label, { color: palette.text }]} numberOfLines={1}>
                  {pictogram.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    borderWidth: 2,
    borderRadius: radius.buttonSmall,
    padding: spacing.sm,
    fontSize: 16,
  },
  message: { ...typography.body, paddingVertical: spacing.sm },
  results: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  result: {
    width: 96,
    borderWidth: 2,
    borderRadius: radius.buttonSmall,
    padding: spacing.xs,
    alignItems: 'center',
  },
  image: { width: 72, height: 72 },
  label: { fontSize: 13, fontWeight: '600' },
});
