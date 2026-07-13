import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { colors } from "@/lib/theme";

type AnimatedSplashScreenProps = {
  ready: boolean;
  onFinish: () => void;
  onReadyForNativeHide: () => void;
};

const MIN_VISIBLE_MS = 820;
const INDICATOR_DELAY_MS = 500;

export function AnimatedSplashScreen({ ready, onFinish, onReadyForNativeHide }: AnimatedSplashScreenProps) {
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const entrance = useSharedValue(0);
  const exit = useSharedValue(1);
  const pulse = useSharedValue(0.72);
  const line = useSharedValue(-1);

  useEffect(() => {
    entrance.value = withTiming(1, {
      duration: 360,
      easing: Easing.out(Easing.cubic)
    });
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 760, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.72, { duration: 760, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    line.value = withDelay(
      INDICATOR_DELAY_MS,
      withRepeat(withTiming(1, { duration: 980, easing: Easing.inOut(Easing.cubic) }), -1, false)
    );

    const minimumTimer = setTimeout(() => setMinimumElapsed(true), MIN_VISIBLE_MS);
    const indicatorTimer = setTimeout(() => {
      if (!ready) setShowIndicator(true);
    }, INDICATOR_DELAY_MS);

    return () => {
      clearTimeout(minimumTimer);
      clearTimeout(indicatorTimer);
    };
  }, [entrance, line, pulse, ready]);

  useEffect(() => {
    if (!ready || !minimumElapsed) return;

    exit.value = withTiming(
      0,
      {
        duration: 220,
        easing: Easing.inOut(Easing.cubic)
      },
      (finished) => {
        if (finished) runOnJS(onFinish)();
      }
    );
  }, [exit, minimumElapsed, onFinish, ready]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: exit.value
  }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ scale: 0.96 + entrance.value * 0.04 }]
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.88 + pulse.value * 0.12 }]
  }));

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: line.value * 112 }]
  }));

  return (
    <Animated.View style={[styles.root, containerStyle]} onLayout={onReadyForNativeHide}>
      <Animated.View style={[styles.brand, markStyle]}>
        <View style={styles.logoMark}>
          <MaterialCommunityIcons name="shield-check-outline" size={34} color={colors.accent} />
        </View>
        <View style={styles.wordmark}>
          <Text variant="headline" style={styles.title}>
            VendorProof
          </Text>
          <Text variant="label" style={styles.caption}>
            Compliance Simplified
          </Text>
        </View>
      </Animated.View>

      {showIndicator && !ready ? (
        <Animated.View style={[styles.indicatorWrap, dotStyle]}>
          <View style={styles.track}>
            <Animated.View style={[styles.accentLine, lineStyle]} />
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  },
  brand: {
    alignItems: "center",
    gap: 14
  },
  logoMark: {
    width: 68,
    height: 68,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(34, 242, 210, 0.24)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 242, 210, 0.08)"
  },
  wordmark: {
    alignItems: "center",
    gap: 3
  },
  title: {
    color: colors.accent,
    letterSpacing: 0
  },
  caption: {
    color: colors.muted,
    letterSpacing: 0.6
  },
  indicatorWrap: {
    position: "absolute",
    bottom: "22%",
    width: 112,
    height: 3,
    overflow: "hidden",
    borderRadius: 999
  },
  track: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(34, 242, 210, 0.12)"
  },
  accentLine: {
    width: 44,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.accent
  }
});
