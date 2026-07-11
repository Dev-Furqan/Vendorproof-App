import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import { supabase } from "@/lib/supabase/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function registerForPushNotifications(userId: string) {
  if (!Device.isDevice) {
    return null;
  }

  const existing = await Notifications.getPermissionsAsync();
  const finalStatus = existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();

  if (finalStatus.status !== "granted") {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

  await supabase.from("users").update({ expo_push_token: token.data }).eq("id", userId);

  return token.data;
}
