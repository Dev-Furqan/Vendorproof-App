import { useEffect, useState } from "react";
import { runOnJS, useAnimatedReaction, useSharedValue, withTiming } from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import type { TextProps } from "react-native";

type AnimatedNumberProps = TextProps & {
  value: number;
  duration?: number;
  className?: string;
};

export function AnimatedNumber({ value, duration = 260, ...props }: AnimatedNumberProps) {
  const progress = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(value, { duration });
  }, [duration, progress, value]);

  useAnimatedReaction(
    () => Math.round(progress.value),
    (current, previous) => {
      if (current !== previous) runOnJS(setDisplayValue)(current);
    },
    [value]
  );

  return (
    <Text variant="display" {...props}>
      {displayValue}
    </Text>
  );
}
