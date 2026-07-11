import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { completeAuthFromUrl, oauthRedirectTo } from "@/lib/supabase/auth";
import { colors } from "@/lib/theme";

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => query.append(key, item));
        return;
      }
      if (typeof value === "string") query.set(key, value);
    });

    completeAuthFromUrl(`${oauthRedirectTo}?${query.toString()}`)
      .then((completed) => {
        router.replace(completed ? "/(tabs)" : "/(auth)/login");
      })
      .catch((callbackError) => {
        setError(callbackError instanceof Error ? callbackError.message : "Could not finish sign in.");
      });
  }, [params]);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.status}>
        {error ? null : <ActivityIndicator color={colors.accent} />}
        <Text variant="title">{error ? "Sign in failed" : "Finishing sign in"}</Text>
        <Text variant="muted" className="text-center">
          {error ?? "VendorProof is connecting your mobile session."}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center"
  },
  status: {
    alignItems: "center",
    gap: 12
  }
});
