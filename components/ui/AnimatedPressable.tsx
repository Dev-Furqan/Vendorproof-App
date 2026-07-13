import { PropsWithChildren } from "react";
import { Pressable, PressableProps, PressableStateCallbackType, StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type AnimatedPressableProps = PropsWithChildren<
  PressableProps & {
    pressedScale?: number;
    style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  }
>;

export function AnimatedPressable({ children, pressedScale = 0.985, style, onPressIn, onPressOut, ...props }: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <AnimatedPressableBase
      {...props}
      style={(state: PressableStateCallbackType) => [typeof style === "function" ? style(state) : style, animatedStyle]}
      onPressIn={(event) => {
        scale.value = withTiming(pressedScale, { duration: 90 });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withTiming(1, { duration: 140 });
        onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressableBase>
  );
}
