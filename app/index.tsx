import { Redirect } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";

import { AnimatedSplashScreen } from "@/components/launch/AnimatedSplashScreen";
import { ensureMobileWorkspace } from "@/lib/auth/workspace";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase/client";

export default function Index() {
  const [route, setRoute] = useState<"/onboarding" | "/(auth)/login" | "/(tabs)" | null>(null);
  const [splashFinished, setSplashFinished] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!data.session?.user) {
          const completedOnboarding = await hasCompletedOnboarding();
          if (mounted) setRoute(completedOnboarding ? "/(auth)/login" : "/onboarding");
          return;
        }

        await ensureMobileWorkspace(data.session.user);
        if (mounted) setRoute("/(tabs)");
      })
      .catch(() => {
        if (mounted) setRoute("/(auth)/login");
      });

    return () => {
      mounted = false;
    };
  }, []);

  function hideNativeSplash() {
    if (nativeSplashHidden) return;
    setNativeSplashHidden(true);
    SplashScreen.hideAsync().catch(() => {});
  }

  if (route && splashFinished) return <Redirect href={route as never} />;

  return <AnimatedSplashScreen ready={Boolean(route)} onFinish={() => setSplashFinished(true)} onReadyForNativeHide={hideNativeSplash} />;
}
