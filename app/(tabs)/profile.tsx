import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { getCurrentWorkspace } from "@/lib/compliance/data";
import { supabase } from "@/lib/supabase/client";
import { colors } from "@/lib/theme";

export default function ProfileScreen() {
  const [workspace, setWorkspace] = useState<{ name: string; role: string | null; email: string | null }>({
    name: "No organization yet",
    role: null,
    email: null
  });

  useEffect(() => {
    getCurrentWorkspace()
      .then(({ user, organization }) => {
        setWorkspace({
          name: organization?.name ?? "No organization yet",
          role: organization?.role ?? null,
          email: user?.email ?? null
        });
      })
      .catch(() => {});
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  const initials = workspace.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Screen>
      <View style={styles.stack}>
        <AppHeader />
        <View style={styles.hero}>
          <Text variant="headline">Profile & Settings</Text>
          <Text variant="muted">{workspace.role ? `${workspace.name} - ${workspace.role}` : workspace.name}</Text>
        </View>

        <Card>
          <View style={styles.avatar}>
            <Text className="text-2xl font-extrabold text-accent">{initials}</Text>
          </View>
          <View>
            <Text variant="title">{workspace.name}</Text>
            <Text variant="muted">{workspace.email ?? "No email available"}</Text>
          </View>
        </Card>

        <Card>
          <Text variant="title">Notification Preferences</Text>
          {["60-day reminders", "30-day reminders", "7-day urgent alerts", "Review assignments"].map((label) => (
            <View key={label} style={styles.preferenceRow}>
              <Text>{label}</Text>
              <Switch value trackColor={{ true: colors.accent, false: colors.border }} thumbColor={colors.foreground} />
            </View>
          ))}
        </Card>

        <Card>
          <Text variant="title">Organization</Text>
          <Text variant="muted">{workspace.name}</Text>
          <Text variant="muted">Realtime Supabase sync enabled</Text>
        </Card>

        <Button variant="danger" onPress={signOut}>
          Sign Out
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 24
  },
  hero: {
    gap: 4
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(87, 241, 219, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(87, 241, 219, 0.1)"
  },
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  }
});
