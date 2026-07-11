import { PropsWithChildren, ReactElement } from "react";
import { RefreshControlProps, ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/lib/theme";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  className?: string;
  contentStyle?: ViewStyle;
  refreshControl?: ReactElement<RefreshControlProps>;
}>;

export function Screen({ children, scroll = true, className = "", contentStyle, refreshControl }: ScreenProps) {
  const content = (
    <View className={className} style={[styles.content, contentStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={styles.fill}>{content}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    paddingBottom: 96
  },
  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 24
  },
  fill: {
    flex: 1,
    backgroundColor: colors.background
  }
});
