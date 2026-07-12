import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { ensureMobileWorkspace } from "@/lib/auth/workspace";
import { supabase } from "@/lib/supabase/client";

WebBrowser.maybeCompleteAuthSession();

export const oauthRedirectTo = Linking.createURL("auth/callback");

const handledAuthUrls = new Set<string>();

export async function signInWithGoogleOAuth() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: oauthRedirectTo,
      skipBrowserRedirect: Platform.OS !== "web"
    }
  });

  if (error || !data.url) {
    throw new Error(error?.message ?? "Could not start Google sign in.");
  }

  if (Platform.OS === "web") {
    await Linking.openURL(data.url);
    return;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirectTo);
  if (result.type === "success") {
    await completeAuthFromUrl(result.url);
    router.replace("/(tabs)");
    return;
  }

  if (result.type === "cancel" || result.type === "dismiss") {
    throw new Error("Google sign in was cancelled.");
  }
}

export async function completeAuthFromUrl(url: string) {
  if (handledAuthUrls.has(url)) {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    return Boolean(session);
  }
  handledAuthUrls.add(url);

  const params = getAuthParams(url);
  const oauthError = params.get("error");
  const errorDescription = params.get("error_description") ?? params.get("error_code");

  if (oauthError) {
    throw new Error(errorDescription ? `${oauthError}: ${errorDescription}` : oauthError);
  }

  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) throw new Error(error.message);
    }
  } else {
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return false;

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (error) throw new Error(error.message);
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) throw new Error(error.message);
  await ensureMobileWorkspace(user);
  return true;
}

export function isAuthCallbackUrl(url: string | null) {
  if (!url) return false;
  return /[?#&](code|access_token|error)=/.test(url);
}

export function isPasswordRecoveryUrl(url: string | null) {
  if (!url || !isAuthCallbackUrl(url)) return false;
  const params = getAuthParams(url);
  return params.get("type") === "recovery";
}

function getAuthParams(url: string) {
  const parsedUrl = new URL(url);
  const params = new URLSearchParams(parsedUrl.search);

  if (parsedUrl.hash.startsWith("#")) {
    const hashParams = new URLSearchParams(parsedUrl.hash.slice(1));
    hashParams.forEach((value, key) => params.set(key, value));
  }

  return params;
}
