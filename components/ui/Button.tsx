import { PropsWithChildren, isValidElement } from "react";
import { Pressable, PressableProps, StyleSheet, ViewStyle } from "react-native";

import { Text } from "@/components/ui/Text";
import { alpha, colors } from "@/lib/theme";

type ButtonProps = PropsWithChildren<
  PressableProps & {
    variant?: "primary" | "secondary" | "danger" | "ghost";
    className?: string;
  }
>;

const textStyles = {
  primary: "text-accent-foreground",
  secondary: "text-foreground",
  danger: "text-missing",
  ghost: "text-accent"
};

export function Button({ children, variant = "primary", className = "", style, ...props }: ButtonProps) {
  const palette = {
    primary: { backgroundColor: colors.accent, borderColor: colors.accent },
    secondary: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
    danger: { backgroundColor: alpha(colors.missing, 0.1), borderColor: alpha(colors.missing, 0.3) },
    ghost: { backgroundColor: "transparent", borderColor: "transparent" }
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      className={className}
      style={({ pressed }) => [
        buttonStyles.button,
        palette,
        variant !== "primary" && variant !== "ghost" ? buttonStyles.outlined : null,
        className.includes("min-h-0") ? buttonStyles.inline : null,
        className.includes("px-0") ? buttonStyles.noPadX : null,
        className.includes("items-start") ? buttonStyles.alignStart : null,
        className.includes("h-14") ? buttonStyles.iconButton : null,
        props.disabled ? buttonStyles.disabled : null,
        pressed && buttonStyles.pressed,
        style as ViewStyle
      ]}
      {...props}
    >
      {isValidElement(children) ? children : <Text className={`text-center font-semibold ${textStyles[variant]}`}>{children}</Text>}
    </Pressable>
  );
}

const buttonStyles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  outlined: {
    borderWidth: 1
  },
  inline: {
    minHeight: 0,
    paddingVertical: 0
  },
  noPadX: {
    paddingHorizontal: 0
  },
  alignStart: {
    alignItems: "flex-start"
  },
  iconButton: {
    width: 56,
    height: 56,
    minHeight: 56,
    paddingHorizontal: 0,
    paddingVertical: 0
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }]
  },
  disabled: {
    opacity: 0.55
  }
});
