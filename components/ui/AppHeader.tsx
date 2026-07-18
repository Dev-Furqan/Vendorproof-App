import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors } from "@/lib/theme";

type AppHeaderProps = {
  eyebrow?: string;
  showFilters?: boolean;
  onSearch?: () => void;
  onFilters?: () => void;
};

export function AppHeader({ eyebrow = "Good Morning, Alex", showFilters = false, onSearch, onFilters }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="shield-account-outline" size={22} color={colors.accent} />
        </View>
        <View>
          <Text variant="muted" style={styles.eyebrow}>
            {eyebrow}
          </Text>
          <Text variant="title" className="text-accent" style={styles.brand}>
            VendorProof
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.iconButton} onPress={onSearch}>
          <MaterialCommunityIcons name="magnify" size={22} color={colors.accent} />
        </Pressable>
        {showFilters ? (
          <Pressable style={styles.iconButton} onPress={onFilters}>
            <MaterialCommunityIcons name="tune-variant" size={22} color={colors.accent} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted
  },
  brand: {
    fontSize: 16,
    lineHeight: 20,
    color: colors.accent
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  }
});
