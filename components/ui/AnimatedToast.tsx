import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { colors } from "@/lib/theme";

export function AnimatedToast({
  message,
  visible,
  onDismiss
}: {
  message: string;
  visible: boolean;
  onDismiss?: () => void;
}) {
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;

    if (!visible) {
      progress.value = withTiming(0, { duration: 160 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
      return;
    }

    progress.value = withSequence(
      withTiming(1.04, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 90 }),
      withDelay(
        2200,
        withTiming(0, { duration: 180 }, (finished) => {
          if (finished && onDismiss) runOnJS(onDismiss)();
        })
      )
    );
  }, [mounted, onDismiss, progress, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value, 1),
    transform: [{ translateY: (1 - Math.min(progress.value, 1)) * -18 }, { scale: 0.98 + Math.min(progress.value, 1) * 0.02 }]
  }));

  if (!mounted) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.toast, animatedStyle]}>
      <Text className="text-accent" variant="label">
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 18,
    alignSelf: "center",
    maxWidth: 320,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34, 242, 210, 0.28)",
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 100
  }
});
