import { Platform } from "react-native";

export const colors = {
  background: "#05070d",
  surface: "#0b111d",
  surfaceMuted: "#111827",
  surfaceHigh: "#172033",
  foreground: "#f7f8fb",
  muted: "#9ba6b6",
  accent: "#22f2d2",
  accentContainer: "#2dd4bf",
  accentForeground: "#04100e",
  border: "#202938",
  outline: "#3c4a46",
  input: "#050912",
  modalNavSurface: "#080d16",
  compliant: "#6ee7b7",
  expiring: "#fcd34d",
  missing: "#fda4af",
  review: "#7dd3fc"
} as const;

export const spacing = {
  screen: 16,
  card: 24,
  stackSm: 8,
  stackMd: 16,
  stackLg: 24,
  section: 24
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 999
} as const;

export const shadows = {
  card:
    Platform.OS === "web"
      ? {
          boxShadow: "0 4px 18px rgba(0, 0, 0, 0.18)"
        }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 18,
          elevation: 2
        }
} as const;

export function alpha(hex: string, opacity: number) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
