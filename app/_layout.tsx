import "../global.css";

import { Stack } from "expo-router";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { completeAuthFromUrl, isAuthCallbackUrl } from "@/lib/supabase/auth";
import { colors } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    async function handleUrl(url: string | null) {
      if (!isAuthCallbackUrl(url)) return;
      try {
        if (!url) return;
        const completed = await completeAuthFromUrl(url);
        if (completed) router.replace("/(tabs)");
      } catch (authError) {
        const message = authError instanceof Error ? authError.message : "Could not finish Google sign in.";
        router.replace({ pathname: "/(auth)/login", params: { authError: message } });
      }
    }

    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="capture" options={{ presentation: "fullScreenModal" }} />
          <Stack.Screen name="documents/[documentId]" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  }
});
