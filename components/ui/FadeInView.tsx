import { PropsWithChildren, useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

type FadeInViewProps = PropsWithChildren<{
  delay?: number;
  style?: StyleProp<ViewStyle>;
  distance?: number;
}>;

export function FadeInView({ children, delay = 0, distance = 8, style }: FadeInViewProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 210 }));
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }, { scale: 0.985 + progress.value * 0.015 }]
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
