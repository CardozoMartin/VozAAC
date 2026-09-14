import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ArasaacPictogram, Board, Category } from '@vozaac/shared';
import { api } from '../api/client';
import { useEditorDraft, type DraftPictogram } from '../state/useEditorDraft';
import { ArasaacPicker } from '../components/ArasaacPicker';
import { CategoryTabs } from '../components/CategoryTabs';
import { paletteFor, radius, spacing, touchTarget, typography } from '../theme';
import { Button } from '../components/ui';

interface Props {
  token: string;
  userId: string;
  onExit: () => void;
  /** Abre los ajustes de accesibilidad (Módulo 5), dentro del modo terapeuta. */
  onOpenAccessibility?: () => void;
  /** Abre la lista de dispositivos vinculados (Módulo 9). */
  onOpenDevices?: () => void;
  /** Abre la lista de responsables del chico/a (Módulo 9, paso 3). */
  onOpenCaregivers?: () => void;
}

/**
 * Editor del tablero, en modo terapeuta (Módulo 4).
 *
 * Los cambios viven en un borrador hasta "Guardar cambios": el terapeuta suele
 * editar con el chico/a al lado, y que los pictogramas cambien bajo su dedo
 * mientras tanto sería confuso para quien está comunicándose.
 */
export function EditorScreen({
  token,
  userId,
  onExit,
  onOpenAccessibility,
  onOpenDevices,
  onOpenCaregivers,
}: Props) {
  const [board, setBoard] = useState<Board | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const palette = paletteFor(undefined);

  const category: Category | null = useMemo(
    () => board?.categories?.find((c) => c.id === categoryId) ?? null,
    [board, categoryId],
  );

  const draft = useEditorDraft([], category);

  useEffect(() => {
    let cancelled = false;

    api
      .defaultBoard(token, userId)
      .then((data) => {
        if (cancelled) return;
        setBoard(data);
        setCategoryId(data.categories?.[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el tablero');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  // Al cambiar de tab se recarga el borrador con los pictogramas de esa
  // categoría. Se toma reset aparte porque es estable entre renders, mientras
  // que draft cambia con cada edición y reiniciaría el borrador a cada tecla.
  const { reset: resetDraft } = draft;
  useEffect(() => {
    resetDraft(category?.pictograms ?? []);
  }, [category, resetDraft]);

  function handlePickArasaac(pictogram: ArasaacPictogram) {
    draft.add({
      text: pictogram.text,
      imageUrl: pictogram.imageUrl,
      arasaacId: pictogram.id,
    });
  }

  function handleAddManual() {
    const text = newText.trim();
    if (!text) return;
    // Sin imagen propia todavía: el terapeuta la sube o elige una de ARASAAC.
    draft.add({ text, imageUrl: '' });
    setNewText('');
  }

  async function handleSave() {
    try {
      await draft.save(token);
      // Se recarga desde el servidor para que el borrador refleje los ids nuevos.
      const fresh = await api.defaultBoard(token, userId);
      setBoard(fresh);
      const recargada = fresh.categories?.find((c) => c.id === categoryId);
      draft.reset(recargada?.pictograms ?? []);
      Alert.alert('Listo', 'Los cambios se guardaron');
    } catch (err) {
      Alert.alert('No se pudo guardar', err instanceof Error ? err.message : 'Intentá de nuevo');
    }
  }

  function handleDiscard() {
    // Descartar es sólo volver al estado del servidor: nada se escribió.
    draft.reset(category?.pictograms ?? []);
  }

  function confirmExit() {
    if (!draft.hasChanges) {
      onExit();
      return;
    }
    Alert.alert('Hay cambios sin guardar', '¿Querés salir igual?', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Salir sin guardar', style: 'destructive', onPress: onExit },
    ]);
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
        <Button label="Volver" variant="secondary" palette={palette} onPress={onExit} />
      </View>
    );
  }

  if (!board) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.accent} testID="editor-loading" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={[styles.header, { borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Editar tablero</Text>
        <View style={styles.headerActions}>
          {onOpenAccessibility && (
            <Button
              testID="button-open-accessibility"
              label="Accesibilidad"
              variant="secondary"
              palette={palette}
              onPress={onOpenAccessibility}
            />
          )}
          {onOpenDevices && (
            <Button
              testID="button-open-devices"
              label="Dispositivos"
              variant="secondary"
              palette={palette}
              onPress={onOpenDevices}
            />
          )}
          {onOpenCaregivers && (
            <Button
              testID="button-open-caregivers"
              label="Responsables"
              variant="secondary"
              palette={palette}
              onPress={onOpenCaregivers}
            />
          )}
          {draft.hasChanges && (
            <Text testID="unsaved-badge" style={[styles.badge, { color: palette.danger }]}>
              Cambios sin guardar
            </Text>
          )}
          <Button
            testID="button-discard"
            label="Descartar"
            variant="secondary"
            palette={palette}
            disabled={!draft.hasChanges}
            onPress={handleDiscard}
          />
          <Button
            testID="button-save"
            label="Guardar cambios"
            palette={palette}
            disabled={!draft.hasChanges}
            loading={draft.saving}
            onPress={handleSave}
          />
          <Button
            testID="button-editor-exit"
            label="Salir"
            accessibilityLabel="Salir del editor"
            variant="secondary"
            palette={palette}
            onPress={confirmExit}
          />
        </View>
      </View>

      <CategoryTabs
        categories={board.categories ?? []}
        selectedId={categoryId}
        palette={palette}
        colorMode={undefined}
        onSelect={setCategoryId}
      />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.addRow}>
          <TextInput
            testID="input-new-pictogram"
            accessibilityLabel="Texto del pictograma"
            placeholder="Agregar pictograma por texto"
            placeholderTextColor={palette.textMuted}
            value={newText}
            onChangeText={setNewText}
            onSubmitEditing={handleAddManual}
            style={[styles.input, { borderColor: palette.border, color: palette.text }]}
          />
          <Button
            testID="button-add-pictogram"
            label="Agregar"
            palette={palette}
            onPress={handleAddManual}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: palette.text }]}>Banco ARASAAC</Text>
        <ArasaacPicker token={token} palette={palette} onPick={handlePickArasaac} />

        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Pictogramas de {category?.name ?? 'la categoría'}
        </Text>
        <View style={styles.list} testID="editor-list">
          {draft.pictograms.map((pictogram) => (
            <EditorRow
              key={pictogram.key}
              pictogram={pictogram}
              palette={palette}
              onRemove={() => draft.remove(pictogram.key)}
              onRestore={() => draft.restore(pictogram.key)}
              onChangeText={(text) => draft.edit(pictogram.key, { text })}
              onToggleUrgent={() => draft.edit(pictogram.key, { isUrgent: !pictogram.isUrgent })}
            />
          ))}
          {draft.pictograms.length === 0 && (
            <Text testID="editor-empty" style={[styles.empty, { color: palette.textMuted }]}>
              Esta categoría todavía no tiene pictogramas
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

interface RowProps {
  pictogram: DraftPictogram;
  palette: ReturnType<typeof paletteFor>;
  onRemove: () => void;
  onRestore: () => void;
  onChangeText: (text: string) => void;
  onToggleUrgent: () => void;
}

/** Una fila editable del listado. */
function EditorRow({
  pictogram,
  palette,
  onRemove,
  onRestore,
  onChangeText,
  onToggleUrgent,
}: RowProps) {
  return (
    <View
      testID={`editor-row-${pictogram.key}`}
      style={[styles.row, { borderColor: palette.border, opacity: pictogram.deleted ? 0.45 : 1 }]}
    >
      {pictogram.imageUrl ? (
        <Image
          source={{ uri: pictogram.imageUrl }}
          style={styles.rowImage}
          resizeMode="contain"
          accessible={false}
        />
      ) : (
        <View style={[styles.rowImage, styles.rowImageEmpty, { borderColor: palette.border }]}>
          <Text style={{ color: palette.textMuted, fontSize: 11 }}>sin imagen</Text>
        </View>
      )}

      <TextInput
        testID={`editor-text-${pictogram.key}`}
        accessibilityLabel={`Texto de ${pictogram.text}`}
        value={pictogram.text}
        onChangeText={onChangeText}
        editable={!pictogram.deleted}
        style={[
          styles.rowInput,
          {
            borderColor: palette.border,
            color: palette.text,
            textDecorationLine: pictogram.deleted ? 'line-through' : 'none',
          },
        ]}
      />

      {/*
        Marca de aviso (Módulo 9, paso 4). Sólo para lo urgente y corporal:
        dolor, me siento mal, angustia, miedo. Pedir el baño no lleva marca —ya
        funciona con el tablero normal—, y si todo notifica el responsable
        silencia las notificaciones y se pierden justo las que importan.
      */}
      {!pictogram.deleted && (
        <Pressable
          testID={`editor-urgent-${pictogram.key}`}
          accessibilityRole="switch"
          accessibilityState={{ checked: pictogram.isUrgent }}
          accessibilityLabel={`Avisar al tocar ${pictogram.text}`}
          onPress={onToggleUrgent}
          style={[
            styles.rowButton,
            {
              borderColor: pictogram.isUrgent ? palette.danger : palette.border,
              backgroundColor: pictogram.isUrgent ? palette.danger : 'transparent',
            },
          ]}
        >
          <Text style={{ color: pictogram.isUrgent ? '#FFFFFF' : palette.textMuted }}>
            {pictogram.isUrgent ? 'Avisa' : 'No avisa'}
          </Text>
        </Pressable>
      )}

      {pictogram.deleted ? (
        <Button
          testID={`editor-restore-${pictogram.key}`}
          label="Deshacer"
          accessibilityLabel="Deshacer el borrado"
          variant="link"
          palette={palette}
          onPress={onRestore}
          style={styles.rowButton}
        />
      ) : (
        <Button
          testID={`editor-remove-${pictogram.key}`}
          label="Borrar"
          accessibilityLabel={`Borrar ${pictogram.text}`}
          variant="danger"
          palette={palette}
          onPress={onRemove}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: typography.sectionTitle,
  badge: { fontSize: 13, fontWeight: '600' },
  body: { padding: spacing.md, gap: spacing.md },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    borderWidth: 2,
    borderRadius: radius.buttonSmall,
    padding: spacing.sm,
    fontSize: 16,
  },
  sectionTitle: { ...typography.subtitle, marginTop: spacing.sm },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.buttonSmall,
    padding: spacing.sm,
  },
  rowImage: { width: 48, height: 48 },
  rowImageEmpty: {
    borderWidth: 1,
    borderRadius: radius.buttonSmall,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.buttonSmall,
    padding: spacing.sm,
    fontSize: 16,
  },
  // El toggle de aviso no es un Button: se anuncia como switch, con su estado
  // marcado, y eso es lo que hace que el lector de pantalla diga si el
  // pictograma avisa o no en vez de leerlo como un botón cualquiera.
  rowButton: {
    borderWidth: 1,
    borderRadius: radius.buttonSmall,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTarget.minHeight,
    justifyContent: 'center',
  },
  empty: { ...typography.body, textAlign: 'center', padding: spacing.lg },
  error: { ...typography.subtitle, textAlign: 'center', paddingHorizontal: spacing.lg },
});
