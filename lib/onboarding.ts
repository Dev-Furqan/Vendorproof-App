import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_COMPLETE_KEY = "vendorproof:onboarding-complete";

export async function hasCompletedOnboarding() {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function markOnboardingComplete() {
  try {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
  } catch {
    // Onboarding should never trap a user if storage is unavailable.
  }
}
