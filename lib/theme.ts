export const colors = {
  background: "#0b0f19",
  surface: "#111827",
  surfaceMuted: "#1d2021",
  surfaceHigh: "#282a2b",
  foreground: "#e1e3e4",
  muted: "#bacac5",
  accent: "#57f1db",
  accentContainer: "#2dd4bf",
  accentForeground: "#003731",
  border: "#1f2937",
  outline: "#3c4a46",
  input: "#030712",
  modalNavSurface: "rgba(29, 32, 33, 0.94)",
  compliant: "#57f1db",
  expiring: "#d3daef",
  missing: "#ffb4ab",
  review: "#c3c6d4"
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
  card: {
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
