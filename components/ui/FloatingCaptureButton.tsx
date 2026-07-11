import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import { colors } from "@/lib/theme";

export function FloatingCaptureButton() {
  return (
    <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={() => router.push("/capture")}>
      <MaterialCommunityIcons name="plus" size={26} color={colors.accentForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: 16,
    bottom: 76,
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 8,
    zIndex: 50
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.96 }]
  }
});
