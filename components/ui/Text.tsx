import { Text as RNText, StyleSheet, TextProps, TextStyle } from "react-native";

import { colors } from "@/lib/theme";

type Variant = "display" | "headline" | "title" | "body" | "label" | "muted";

const variants: Record<Variant, string> = {
  display: "font-display text-4xl font-bold leading-tight text-foreground",
  headline: "font-display text-2xl font-semibold leading-8 text-foreground",
  title: "font-display text-lg font-semibold leading-6 text-foreground",
  body: "font-body text-base leading-6 text-foreground",
  label: "font-body text-xs font-semibold uppercase leading-4 text-muted",
  muted: "font-body text-sm leading-5 text-muted"
};

export function Text({ className = "", variant = "body", ...props }: TextProps & { variant?: Variant }) {
  const color = inferColor(variant, className);
  const font = variantStyles[variant];
  const extra = inferExtraStyle(className);

  return <RNText className={`${variants[variant]} ${className}`} style={[font, { color }, extra, props.style]} {...props} />;
}

function inferColor(variant: Variant, className: string) {
  if (className.includes("text-accent-foreground")) return colors.accentForeground;
  if (className.includes("text-accent")) return colors.accent;
  if (className.includes("text-foreground")) return colors.foreground;
  if (className.includes("text-muted") || variant === "muted" || variant === "label") return colors.muted;
  if (className.includes("text-compliant")) return colors.compliant;
  if (className.includes("text-expiring")) return colors.expiring;
  if (className.includes("text-missing")) return colors.missing;
  if (className.includes("text-review")) return colors.review;
  return colors.foreground;
}

function inferExtraStyle(className: string): TextStyle {
  return {
    textAlign: className.includes("text-center") ? "center" : undefined,
    fontWeight: className.includes("font-extrabold")
      ? "800"
      : className.includes("font-bold")
        ? "700"
        : className.includes("font-semibold")
          ? "600"
        : undefined,
    fontSize: className.includes("text-2xl") ? 24 : className.includes("text-sm") ? 14 : className.includes("text-xs") ? 12 : undefined,
    lineHeight: className.includes("text-2xl") ? 30 : undefined
  };
}

const variantStyles = StyleSheet.create({
  display: {
    fontSize: 40,
    fontWeight: "700",
    lineHeight: 46,
    letterSpacing: -0.8
  },
  headline: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
    letterSpacing: -0.35
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24
  },
  body: {
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 24
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  muted: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20
  }
});
