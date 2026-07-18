import { PropsWithChildren, useEffect, useState } from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { colors, radii, spacing } from "@/lib/theme";

export function AnimatedSheet({
  visible,
  children,
  onDismiss,
  contentStyle
}: PropsWithChildren<{ visible: boolean; onDismiss: () => void; contentStyle?: ViewStyle }>) {
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;

    progress.value = withTiming(visible ? 1 : 0, { duration: visible ? 220 : 180 }, (finished) => {
      if (finished && !visible) runOnJS(setMounted)(false);
    });
  }, [mounted, progress, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 24 }]
  }));

  if (!mounted) return null;

  return (
    <Animated.View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      </Animated.View>
      <Animated.View style={[styles.sheet, contentStyle, sheetStyle]}>{children}</Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0, 0, 0, 0.48)"
  },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl
  }
});
