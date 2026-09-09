import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import type { Pictogram } from '@vozaac/shared';
import type { Palette } from '../theme';
import { spacing } from '../theme';
import { useTremorFilter, type TremorFilterOptions } from '../state/useTremorFilter';

interface Props {
  pictogram: Pictogram;
  /** Color de la categoría, que se usa como borde (convención Fitzgerald Key). */
  color: string;
  palette: Palette;
  onPress: (pictogram: Pictogram) => void;
  /** Configuración del filtro anti-temblor (Módulo 5). */
  tremor: TremorFilterOptions;
}

/**
 * Una celda de la grilla.
 *
 * El área táctil ocupa toda la celda —no sólo la imagen— porque la puntería
 * fina no se puede dar por supuesta.
 *
 * Con el filtro anti-temblor activo la celda se llena con una barra de
 * progreso mientras el dedo sostiene. No es decoración: sin ella el retardo se
 * siente como que la app se colgó, y el chico/a levanta el dedo justo antes de
 * confirmar. Ver la barra avanzar enseña cuánto falta.
 */
export function PictogramCell({ pictogram, color, palette, onPress, tremor }: Props) {
  const [holding, setHolding] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);

  const handleConfirm = useCallback(() => {
    setHolding(false);
    onPress(pictogram);
  }, [onPress, pictogram]);

  const filter = useTremorFilter(tremor, handleConfirm);

  const stopAnimation = useCallback(() => {
    animation.current?.stop();
    animation.current = null;
    progress.setValue(0);
    setHolding(false);
  }, [progress]);

  useEffect(() => stopAnimation, [stopAnimation]);

  const showsProgress = tremor.enabled && tremor.holdToConfirmMs > 0;

  function handlePressIn(event: GestureResponderEvent) {
    const { pageX, pageY } = event.nativeEvent;
    filter.onPressIn({ x: pageX, y: pageY });

    if (!showsProgress) return;
    setHolding(true);
    progress.setValue(0);
    animation.current = Animated.timing(progress, {
      toValue: 1,
      duration: tremor.holdToConfirmMs,
      // La barra anima el ancho, que no es una propiedad que el driver nativo
      // sepa interpolar; con useNativeDriver en true no se movería.
      useNativeDriver: false,
    });
    animation.current.start();
  }

  function handlePressOut() {
    filter.onPressOut();
    stopAnimation();
  }

  function handleTouchMove(event: GestureResponderEvent) {
    const { pageX, pageY } = event.nativeEvent;
    filter.onTouchMove({ x: pageX, y: pageY });
  }

  return (
    <Pressable
      testID={`pictogram-${pictogram.id}`}
      accessibilityRole="button"
      accessibilityLabel={pictogram.text}
      onPress={filter.onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onTouchMove={handleTouchMove}
      // Sin esto el Pressable espera a saber si el gesto es un scroll y demora
      // el onPressIn, que es justo donde arranca el conteo del hold.
      unstable_pressDelay={0}
      style={({ pressed }) => [
        styles.cell,
        {
          borderColor: color,
          backgroundColor: palette.surface,
          // Respuesta visual inmediata: confirma el toque a quien no oye el TTS.
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      {holding && (
        <Animated.View
          testID={`hold-progress-${pictogram.id}`}
          pointerEvents="none"
          style={[
            styles.progress,
            {
              backgroundColor: color,
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      )}

      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: pictogram.imageUrl }}
          style={styles.image}
          resizeMode="contain"
          accessible={false}
        />
      </View>
      <Text style={[styles.text, { color: palette.text }]} numberOfLines={2}>
        {pictogram.text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    margin: spacing.xs,
    borderWidth: 3,
    borderRadius: 12,
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    // Recorta la barra de progreso a los bordes redondeados de la celda.
    overflow: 'hidden',
  },
  progress: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 6,
    opacity: 0.85,
  },
  imageWrapper: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  text: {
    marginTop: spacing.xs,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
