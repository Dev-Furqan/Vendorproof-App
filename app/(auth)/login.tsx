import { zodResolver } from "@hookform/resolvers/zod";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, View } from "react-native";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormInput } from "@/components/ui/FormInput";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { ensureMobileWorkspace } from "@/lib/auth/workspace";
import { toFriendlyNetworkError } from "@/lib/network";
import { oauthRedirectTo, signInWithGoogleOAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { alpha, colors, radii, spacing } from "@/lib/theme";

const authSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8)
});

type AuthForm = z.infer<typeof authSchema>;
type AuthMode = "login" | "signup";

export default function LoginScreen() {
  const params = useLocalSearchParams<{ authError?: string }>();
  const [mode, setMode] = useState<AuthMode>("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, getValues } = useForm<AuthForm>({
    resolver: zodResolver(authSchema),
    defaultValues: { fullName: "", email: "", password: "" }
  });

  useEffect(() => {
    if (typeof params.authError === "string" && params.authError.length > 0) {
      setAuthError(params.authError);
    }
  }, [params.authError]);

  async function signIn(values: AuthForm) {
    setSubmitting(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email.trim().toLowerCase(),
        password: values.password
      });
      if (error) {
        setAuthError(toFriendlyAuthError(error.message));
        return;
      }
      await ensureMobileWorkspace(data.user);
      router.replace("/(tabs)");
    } catch (workspaceError) {
      setAuthError(toFriendlyNetworkError(workspaceError, "Could not prepare your mobile workspace."));
    } finally {
      setSubmitting(false);
    }
  }

  async function signUp(values: AuthForm) {
    const fullName = values.fullName?.trim() ?? "";
    if (!fullName) {
      setAuthError("Enter your full name to create an account.");
      return;
    }

    setSubmitting(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: oauthRedirectTo
        }
      });

      if (error) {
        setAuthError(toFriendlyAuthError(error.message));
        return;
      }

      if (!data.session) {
        setAuthMessage("Account created. Check your email to confirm it, then sign in from the mobile app.");
        setMode("login");
        return;
      }

      await ensureMobileWorkspace(data.user);
    } catch (workspaceError) {
      setAuthError(toFriendlyNetworkError(workspaceError, "Could not prepare your mobile workspace."));
      return;
    } finally {
      setSubmitting(false);
    }
    router.replace("/(tabs)");
  }

  async function signInWithGoogle() {
    setAuthError(null);
    setAuthMessage(null);
    setSubmitting(true);
    try {
      await signInWithGoogleOAuth();
    } catch (googleError) {
      setAuthError(googleError instanceof Error ? googleError.message : "Could not start Google sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendPasswordReset() {
    const email = getValues("email").trim().toLowerCase();
    setAuthError(null);
    setAuthMessage(null);

    if (!z.string().email().safeParse(email).success) {
      setAuthError("Enter your email address first, then tap Forgot Password.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: oauthRedirectTo
      });

      if (error) {
        setAuthError(toFriendlyAuthError(error.message));
        return;
      }

      setAuthMessage("Password reset sent. Open the link on this phone to choose a new password.");
    } catch (resetError) {
      setAuthError(toFriendlyNetworkError(resetError, "Could not send password reset."));
    } finally {
      setSubmitting(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <Screen contentStyle={styles.screenContent}>
      <View style={styles.identity}>
        <View style={styles.logo}>
          <MaterialCommunityIcons name="shield-check-outline" size={34} color={colors.accent} />
        </View>
        <View style={styles.centerCopy}>
          <Text variant="headline" className="text-accent">
            VendorProof
          </Text>
          <Text variant="muted">Compliance Simplified.</Text>
        </View>
      </View>

      <Card style={styles.formCard}>
        <View style={styles.modeRow}>
          <Pressable style={[styles.modeButton, !isSignup && styles.modeButtonActive]} onPress={() => setMode("login")}>
            <Text className={!isSignup ? "text-accent-foreground font-semibold" : "text-muted"}>Sign in</Text>
          </Pressable>
          <Pressable style={[styles.modeButton, isSignup && styles.modeButtonActive]} onPress={() => setMode("signup")}>
            <Text className={isSignup ? "text-accent-foreground font-semibold" : "text-muted"}>Create account</Text>
          </Pressable>
        </View>

        {isSignup ? (
          <View>
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, value } }) => (
                <FormInput
                  label="Full Name"
                  autoCapitalize="words"
                  placeholder="Your name"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
          </View>
        ) : null}

        <View>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Email Address"
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@company.com"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
        </View>

        <View style={styles.passwordField}>
          <View style={styles.passwordHeader}>
            <Text variant="label">Password</Text>
            <Pressable onPress={sendPasswordReset} disabled={submitting}>
              <Text variant="label" className="text-accent">
                Forgot Password?
              </Text>
            </Pressable>
          </View>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <FormInput
                secureTextEntry
                placeholder="********"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
        </View>

        {authError ? (
          <View style={styles.errorBox}>
            <Text className="text-missing">{authError}</Text>
          </View>
        ) : null}

        {authMessage ? (
          <View style={styles.messageBox}>
            <Text className="text-compliant">{authMessage}</Text>
          </View>
        ) : null}

        <Button disabled={submitting} onPress={handleSubmit(isSignup ? signUp : signIn)}>
          {submitting ? (isSignup ? "Creating account..." : "Signing in...") : isSignup ? "Create Account  ->" : "Login  ->"}
        </Button>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text variant="label">or</Text>
          <View style={styles.divider} />
        </View>

        <Button variant="secondary" disabled={submitting} onPress={signInWithGoogle}>
          {isSignup ? "Sign up with Google" : "Continue with Google"}
        </Button>

      </Card>

      <Pressable onPress={() => setMode(isSignup ? "login" : "signup")}>
        <Text variant="muted" className="text-center">
          {isSignup ? "Already have an account? Sign in" : "Don't have an account? Create one"}
        </Text>
      </Pressable>
    </Screen>
  );
}

function toFriendlyAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return "The email or password is incorrect. Check both fields and try again.";
  if (/email not confirmed/i.test(message)) return "Confirm your email address before signing in.";
  if (/user not found|not registered/i.test(message)) return "No VendorProof account was found for that email address.";
  if (/network|fetch|failed to fetch/i.test(message)) return "Network connection failed. Check your connection and try again.";
  return message || "Authentication failed. Try again in a moment.";
}

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    justifyContent: "center",
    maxWidth: 420,
    gap: 24,
    paddingVertical: 36
  },
  identity: {
    alignItems: "center",
    gap: 16
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha(colors.accent, 0.25),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(colors.accent, 0.1)
  },
  centerCopy: {
    alignItems: "center",
    gap: 4
  },
  formCard: {
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface
  },
  modeRow: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    padding: 4,
    gap: 4
  },
  modeButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  modeButtonActive: {
    backgroundColor: colors.accent
  },
  passwordField: {
    gap: spacing.sm
  },
  errorBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: alpha(colors.missing, 0.3),
    backgroundColor: alpha(colors.missing, 0.08),
    padding: 12
  },
  messageBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: alpha(colors.compliant, 0.28),
    backgroundColor: alpha(colors.compliant, 0.08),
    padding: 12
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border
  },
  passwordHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  }
});
