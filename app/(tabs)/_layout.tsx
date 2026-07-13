import { Tabs } from "expo-router";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { ensureMobileWorkspace } from "@/lib/auth/workspace";
import { supabase } from "@/lib/supabase/client";
import { colors } from "@/lib/theme";

const iconMap = {
  index: "view-dashboard-outline",
  properties: "office-building-outline",
  vendors: "briefcase-outline",
  notifications: "bell-outline",
  profile: "account-circle-outline"
} as const;

export default function TabsLayout() {
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!data.session?.user) {
          if (mounted) router.replace("/(auth)/login");
          return;
        }
        await ensureMobileWorkspace(data.session.user);
        if (mounted) setCheckingSession(false);
      })
      .catch(() => {
        if (mounted) router.replace("/(auth)/login");
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        router.replace("/(auth)/login");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (checkingSession) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.modalNavSurface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          minHeight: 66,
          height: 66,
          paddingTop: 8,
          paddingBottom: 8,
          position: "absolute"
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ color, focused, size }) => (
          <AnimatedTabIcon name={iconMap[route.name as keyof typeof iconMap] ?? "circle-outline"} color={String(color)} focused={focused} size={size} />
        )
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="properties" options={{ title: "Properties" }} />
      <Tabs.Screen name="vendors" options={{ title: "Vendors" }} />
      <Tabs.Screen name="notifications" options={{ title: "Alerts" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

function AnimatedTabIcon({
  color,
  focused,
  name,
  size
}: {
  color: string;
  focused: boolean;
  name: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  size: number;
}) {
  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    active.value = withTiming(focused ? 1 : 0, { duration: 180 });
  }, [active, focused]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: active.value * -2 }, { scale: 1 + active.value * 0.06 }]
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ scaleX: active.value }]
  }));

  return (
    <View style={styles.tabIcon}>
      <Animated.View style={iconStyle}>
        <MaterialCommunityIcons name={name} size={size} color={color} />
      </Animated.View>
      <Animated.View style={[styles.tabIndicator, indicatorStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  },
  tabIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    width: 18,
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.accent
  }
});
