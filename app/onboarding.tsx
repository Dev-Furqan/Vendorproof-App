import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Carousel, { type ICarouselInstance } from "react-native-reanimated-carousel";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { markOnboardingComplete } from "@/lib/onboarding";
import { colors } from "@/lib/theme";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type OnboardingSlide = {
  icon: IconName;
  eyebrow: string;
  title: string;
  copy: string;
};

const slides: OnboardingSlide[] = [
  {
    icon: "calendar-sync-outline",
    eyebrow: "Renewals",
    title: "Never miss a renewal",
    copy: "Track vendor COIs, licenses, and W-9s automatically, with dates kept visible before they become urgent."
  },
  {
    icon: "view-dashboard-outline",
    eyebrow: "Dashboard",
    title: "See compliance at a glance",
    copy: "Scan red, yellow, and green status across properties and vendors without digging through files."
  },
  {
    icon: "camera-iris",
    eyebrow: "Capture",
    title: "Scan documents in seconds",
    copy: "Use the camera to upload documents and let AI extract the details for faster review."
  },
  {
    icon: "bell-ring-outline",
    eyebrow: "Alerts",
    title: "Get alerted before it's too late",
    copy: "Receive push notifications when documents are missing, expiring soon, or ready for review."
  }
];

export default function OnboardingScreen() {
  const carouselRef = useRef<ICarouselInstance>(null);
  const progress = useSharedValue(0);
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const isLast = index === slides.length - 1;
  const compact = height < 720;
  const carouselHeight = Math.max(320, Math.min(height - 248, 510));

  async function finishOnboarding() {
    await markOnboardingComplete();
    router.replace("/(auth)/login");
  }

  function next() {
    if (isLast) {
      void finishOnboarding();
      return;
    }

    carouselRef.current?.next({ animated: true });
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.accent} />
          <Text variant="title" style={styles.brandText}>
            VendorProof
          </Text>
        </View>
        <Pressable hitSlop={12} style={({ pressed }) => [styles.skip, pressed && styles.pressed]} onPress={() => void finishOnboarding()}>
          <Text variant="label" style={styles.skipText}>
            Skip
          </Text>
        </Pressable>
      </View>

      <Carousel
        ref={carouselRef}
        data={slides}
        width={width}
        height={carouselHeight}
        loop={false}
        autoFillData={false}
        mode="parallax"
        modeConfig={{
          parallaxScrollingOffset: Math.min(72, width * 0.18),
          parallaxScrollingScale: 0.92,
          parallaxAdjacentItemScale: 0.84
        }}
        scrollAnimationDuration={520}
        onProgressChange={progress}
        onSnapToItem={setIndex}
        renderItem={({ item, animationValue }) => (
          <SlideContent slide={item} compact={compact} animationValue={animationValue} />
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((slide, dotIndex) => (
            <PaginationDot key={slide.title} index={dotIndex} progress={progress} />
          ))}
        </View>
        <Button onPress={next}>{isLast ? "Get Started" : "Next"}</Button>
      </View>
    </SafeAreaView>
  );
}

function SlideContent({
  slide,
  compact,
  animationValue
}: {
  slide: OnboardingSlide;
  compact: boolean;
  animationValue: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(animationValue.value), [0, 0.72, 1], [1, 0.76, 0.52], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(animationValue.value, [-1, 0, 1], [28, 0, -28], Extrapolation.CLAMP) },
      { scale: interpolate(Math.abs(animationValue.value), [0, 1], [1, 0.96], Extrapolation.CLAMP) }
    ]
  }));

  return (
    <Animated.View style={[styles.slide, compact && styles.slideCompact, animatedStyle]}>
      <View style={[styles.visual, compact && styles.visualCompact]}>
        <View style={styles.ringOuter} />
        <View style={styles.ringInner} />
        <View style={styles.iconPlate}>
          <MaterialCommunityIcons name={slide.icon} size={compact ? 42 : 50} color={colors.accent} />
        </View>
      </View>
      <View style={styles.copyBlock}>
        <Text variant="label" style={styles.eyebrow}>
          {slide.eyebrow}
        </Text>
        <Text variant="display" style={[styles.title, compact && styles.titleCompact]}>
          {slide.title}
        </Text>
        <Text variant="body" style={styles.copy}>
          {slide.copy}
        </Text>
      </View>
    </Animated.View>
  );
}

function PaginationDot({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(progress.value - index);
    const clampedDistance = Math.min(distance, 1);

    return {
      width: withTiming(interpolate(clampedDistance, [0, 1], [28, 8], Extrapolation.CLAMP), { duration: 180 }),
      opacity: withTiming(interpolate(clampedDistance, [0, 1], [1, 0.42], Extrapolation.CLAMP), { duration: 180 }),
      backgroundColor: clampedDistance < 0.5 ? colors.accent : "rgba(155, 166, 182, 0.42)"
    };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  brandText: {
    color: colors.accent,
    fontSize: 17,
    lineHeight: 22
  },
  skip: {
    minHeight: 36,
    minWidth: 58,
    alignItems: "flex-end",
    justifyContent: "center"
  },
  skipText: {
    color: colors.muted,
    letterSpacing: 0.4
  },
  pressed: {
    opacity: 0.72
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 34
  },
  slideCompact: {
    gap: 22,
    paddingHorizontal: 24
  },
  visual: {
    width: 214,
    height: 214,
    alignItems: "center",
    justifyContent: "center"
  },
  visualCompact: {
    width: 168,
    height: 168
  },
  ringOuter: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34, 242, 210, 0.14)"
  },
  ringInner: {
    position: "absolute",
    width: "72%",
    height: "72%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34, 242, 210, 0.26)",
    backgroundColor: "rgba(34, 242, 210, 0.045)"
  },
  iconPlate: {
    width: 92,
    height: 92,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(34, 242, 210, 0.28)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 242, 210, 0.09)"
  },
  copyBlock: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    gap: 12
  },
  eyebrow: {
    color: colors.accent,
    letterSpacing: 0.8
  },
  title: {
    color: colors.foreground,
    textAlign: "center",
    fontSize: 36,
    lineHeight: 42
  },
  titleCompact: {
    fontSize: 31,
    lineHeight: 37
  },
  copy: {
    color: colors.muted,
    textAlign: "center",
    maxWidth: 320
  },
  footer: {
    gap: 22,
    paddingHorizontal: 20,
    paddingBottom: 16
  },
  dots: {
    height: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  dot: {
    height: 8,
    borderRadius: 999
  }
});
