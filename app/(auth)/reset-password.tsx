import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, TextInput, View } from "react-native";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { toFriendlyNetworkError } from "@/lib/network";
import { supabase } from "@/lib/supabase/client";
import { colors } from "@/lib/theme";

const resetSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your password.")
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

type ResetForm = z.infer<typeof resetSchema>;

export default function ResetPasswordScreen() {
  const [formState, setFormState] = useState<{ submitting: boolean; error: string | null }>({ submitting: false, error: null });
  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" }
  });

  async function updatePassword(values: ResetForm) {
    setFormState({ submitting: true, error: null });
    try {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      setFormState({ submitting: false, error: error?.message ?? null });

      if (!error) {
        router.replace("/(tabs)");
      }
    } catch (error) {
      setFormState({ submitting: false, error: toFriendlyNetworkError(error, "Could not update password.") });
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text variant="headline">Reset Password</Text>
          <Text variant="muted">Choose a new password for your VendorProof account.</Text>
        </View>

        <View style={styles.field}>
          <Text variant="label">New Password</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <TextInput
                secureTextEntry
                placeholder="********"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={value}
                onChangeText={onChange}
              />
            )}
          />
          {errors.password?.message ? <Text className="text-missing">{errors.password.message}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text variant="label">Confirm Password</Text>
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, value } }) => (
              <TextInput
                secureTextEntry
                placeholder="********"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={value}
                onChangeText={onChange}
              />
            )}
          />
          {errors.confirmPassword?.message ? <Text className="text-missing">{errors.confirmPassword.message}</Text> : null}
        </View>

        {formState.error ? (
          <View style={styles.errorBox}>
            <Text className="text-missing">{formState.error}</Text>
          </View>
        ) : null}

        <Button disabled={formState.submitting} onPress={handleSubmit(updatePassword)}>
          {formState.submitting ? "Updating..." : "Update Password"}
        </Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    maxWidth: 420,
    paddingVertical: 36
  },
  card: {
    gap: 16,
    padding: 20
  },
  header: {
    gap: 6
  },
  field: {
    gap: 8
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    color: colors.foreground,
    paddingHorizontal: 14,
    fontSize: 16
  },
  errorBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(253, 164, 175, 0.3)",
    backgroundColor: "rgba(253, 164, 175, 0.08)",
    padding: 12
  }
});
