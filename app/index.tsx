import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ensureMobileWorkspace } from "@/lib/auth/workspace";
import { supabase } from "@/lib/supabase/client";
import { colors } from "@/lib/theme";

export default function Index() {
  const [route, setRoute] = useState<"/(auth)/login" | "/(tabs)" | null>(null);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!data.session?.user) {
          setRoute("/(auth)/login");
          return;
        }

        await ensureMobileWorkspace(data.session.user);
        setRoute("/(tabs)");
      })
      .catch(() => setRoute("/(auth)/login"));
  }, []);

  if (route) return <Redirect href={route} />;

  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  }
});
