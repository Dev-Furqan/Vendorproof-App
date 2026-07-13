import { PropsWithChildren, useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

export function RefreshSettleView({
  children,
  refreshing,
  style
}: PropsWithChildren<{ refreshing: boolean; style?: StyleProp<ViewStyle> }>) {
  const progress = useSharedValue(1);

  useEffect(() => {
    if (refreshing) {
      progress.value = withTiming(0.92, { duration: 120 });
      return;
    }

    progress.value = withTiming(1, { duration: 220 });
  }, [progress, refreshing]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 22 }]
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
