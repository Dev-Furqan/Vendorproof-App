import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { colors } from "@/lib/theme";

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [captured, setCaptured] = useState(false);

  if (!permission?.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Text variant="headline">Camera Access</Text>
        <Text variant="muted">VendorProof uses the camera to capture compliance documents for internal review.</Text>
        <Button onPress={requestPermission}>Allow Camera</Button>
        <Button variant="secondary" onPress={() => router.back()}>
          Cancel
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="close" size={24} color={colors.foreground} />
          </Pressable>
          <Text variant="title">Scan Document</Text>
          <View style={styles.closeButton} />
        </View>

        <View style={styles.frame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>

        <View style={styles.bottomPanel}>
          {captured ? (
            <View style={styles.previewPanel}>
              <Text variant="title">Preview ready</Text>
              <Text variant="muted">Mobile upload is not connected yet. Upload this document from the web app to create a real review record.</Text>
              <Button variant="secondary" onPress={() => setCaptured(false)}>
                Retake
              </Button>
            </View>
          ) : (
            <View style={styles.captureRow}>
              <Button variant="secondary" className="h-14 px-0">
                <MaterialCommunityIcons name="image-outline" size={24} color={colors.foreground} />
              </Button>
              <Pressable style={styles.shutter} onPress={() => setCaptured(true)}>
                <View style={styles.shutterInner} />
              </Pressable>
              <View style={styles.spacerButton} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionScreen: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
    padding: 16,
    backgroundColor: colors.background
  },
  root: {
    flex: 1,
    backgroundColor: "#000"
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.18)"
  },
  topBar: {
    paddingTop: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.42)"
  },
  frame: {
    alignSelf: "center",
    width: "92%",
    maxWidth: 380,
    height: 430,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(34, 242, 210, 0.35)"
  },
  corner: {
    position: "absolute",
    width: 52,
    height: 52,
    borderColor: colors.accent
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 18
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 18
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 18
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 18
  },
  bottomPanel: {
    paddingBottom: 28
  },
  previewPanel: {
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(11, 15, 25, 0.92)",
    padding: 16
  },
  captureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around"
  },
  shutter: {
    width: 82,
    height: 82,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: colors.foreground,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "rgba(4, 16, 14, 0.16)"
  },
  spacerButton: {
    width: 56,
    height: 56
  }
});
