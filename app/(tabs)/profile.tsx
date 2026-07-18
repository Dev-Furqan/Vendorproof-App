import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { getCurrentWorkspace } from "@/lib/compliance/data";
import { toFriendlyNetworkError } from "@/lib/network";
import { supabase } from "@/lib/supabase/client";
import { alpha, colors, radii, spacing } from "@/lib/theme";

export default function ProfileScreen() {
  const [workspace, setWorkspace] = useState<{ name: string; role: string | null; email: string | null }>({
    name: "No organization yet",
    role: null,
    email: null
  });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    getCurrentWorkspace()
      .then(({ user, organization }) => {
        if (!mounted) return;
        setWorkspace({
          name: organization?.name ?? "No organization yet",
          role: organization?.role ?? null,
          email: user?.email ?? null
        });
      })
      .catch((error) => {
        if (mounted) setProfileError(toFriendlyNetworkError(error, "Could not load profile."));
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function signOut() {
    setSigningOut(true);
    setProfileError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/(auth)/login");
    } catch (error) {
      setProfileError(toFriendlyNetworkError(error, "Could not sign out."));
      setSigningOut(false);
    }
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

        <Card style={styles.profileCard}>
          <View style={styles.profileIdentity}>
            <View style={styles.avatar}>
              <Text className="text-2xl font-extrabold text-accent">{initials}</Text>
            </View>
            <View style={styles.profileCopy}>
              <Text variant="title">{workspace.name}</Text>
              <Text variant="muted">{workspace.email ?? "No email available"}</Text>
              {workspace.role ? <View style={styles.rolePill}><Text variant="label" className="text-accent">{workspace.role}</Text></View> : null}
            </View>
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

        {profileError ? (
          <Card>
            <Text className="text-missing">{profileError}</Text>
          </Card>
        ) : null}

        <Button variant="danger" disabled={signingOut} onPress={signOut}>
          {signingOut ? "Signing out..." : "Sign Out"}
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.section
  },
  hero: {
    gap: 4
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha(colors.accent, 0.2),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(colors.accent, 0.1)
  },
  profileCard: {
    gap: 0
  },
  profileIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg
  },
  profileCopy: {
    flex: 1,
    gap: spacing.xs
  },
  rolePill: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: alpha(colors.accent, 0.22),
    backgroundColor: alpha(colors.accent, 0.07),
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 46,
    paddingVertical: 4
  }
});
