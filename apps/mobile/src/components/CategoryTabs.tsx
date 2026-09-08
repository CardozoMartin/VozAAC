import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Category, ColorMode } from '@vozaac/shared';
import { categoryColor, spacing, type Palette } from '../theme';

interface Props {
  categories: Category[];
  selectedId: string | null;
  palette: Palette;
  colorMode: ColorMode | undefined;
  onSelect: (categoryId: string) => void;
}

/** Tabs de categorías del tablero (Módulo 3). */
export function CategoryTabs({ categories, selectedId, palette, colorMode, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      testID="category-tabs"
    >
      {categories.map((category) => {
        const selected = category.id === selectedId;
        const color = categoryColor(category.color, colorMode);
        return (
          <Pressable
            key={category.id}
            testID={`category-${category.id}`}
            accessibilityRole="tab"
            accessibilityLabel={category.name}
            accessibilityState={{ selected }}
            onPress={() => onSelect(category.id)}
            style={[
              styles.tab,
              {
                borderColor: color,
                // La categoría activa se rellena con su color; las otras van al aire.
                backgroundColor: selected ? color : palette.surface,
              },
            ]}
          >
            <Text style={[styles.label, { color: selected ? '#FFFFFF' : palette.text }]}>
              {category.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 0 },
  content: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: spacing.sm },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 3,
    borderRadius: 12,
    minWidth: 110,
    alignItems: 'center',
  },
  label: { fontSize: 18, fontWeight: '700' },
});
