import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { useComplianceData } from "@/lib/compliance/data";
import {
  createManualReviewDocument,
  retryCapturedDocumentExtraction,
  uploadCapturedDocument,
  type UploadStep
} from "@/lib/documents/mobile-documents";
import type { DocumentSource } from "@/lib/documents/preprocess";
import { toFriendlyNetworkError } from "@/lib/network";
import { colors } from "@/lib/theme";
import type { VendorRequirementRecord } from "@/types/compliance";

type CapturedAsset = DocumentSource;

const documentTypes = [
  { label: "COI", value: "coi" },
  { label: "License", value: "license" },
  { label: "W-9", value: "w9" }
];

const stepLabels: Record<UploadStep, string> = {
  preparing: "Preparing image",
  preprocessing: "Correcting crop, lighting, and resolution",
  uploading: "Uploading to secure storage",
  creating_record: "Creating document record",
  extracting: "Extracting fields with AI",
  saving_extraction: "Saving extracted fields",
  success: "Upload complete"
};

export default function CaptureScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const { data, loading } = useComplianceData();
  const [captured, setCaptured] = useState<CapturedAsset | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [documentType, setDocumentType] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualDocumentId, setManualDocumentId] = useState<string | null>(null);
  const shutterScale = useSharedValue(1);
  const flashOpacity = useSharedValue(0);

  const requirements = useMemo(
    () =>
      data.requirements.map((requirement) => ({
        requirement,
        vendorName: data.vendors.find((vendor) => vendor.id === requirement.vendor_id)?.name ?? "Unknown vendor",
        propertyName: requirement.property_id ? data.properties.find((property) => property.id === requirement.property_id)?.name ?? "Unknown property" : "Unassigned"
      })),
    [data.properties, data.requirements, data.vendors]
  );
  const selectedRequirement = requirements.find((item) => item.requirement.id === requirementId)?.requirement ?? null;
  const busy = capturing || uploadStep !== null;

  async function requestCamera() {
    setError(null);
    try {
      const result = await requestPermission();
      if (!result.granted && !result.canAskAgain) {
        setError("Camera permission is blocked. Open device settings to re-enable camera access for VendorProof.");
      }
    } catch (permissionError) {
      setError(toFriendlyNetworkError(permissionError, "Could not request camera permission."));
    }
  }

  async function capturePhoto() {
    if (!cameraRef.current || capturing) return;
    setError(null);
    setCapturing(true);
    shutterScale.value = withSequence(withTiming(0.9, { duration: 70 }), withTiming(1.06, { duration: 90 }), withTiming(1, { duration: 120 }));
    flashOpacity.value = withSequence(withTiming(0.28, { duration: 80 }), withTiming(0, { duration: 180 }));
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.88, base64: true, skipProcessing: false });
      if (!photo?.uri) throw new Error("The camera did not return a usable image.");
      setManualMode(false);
      setCaptured({
        uri: photo.uri,
        base64: photo.base64 ?? null,
        mimeType: "image/jpeg",
        fileName: `camera-document-${Date.now()}.jpg`,
        width: photo.width,
        height: photo.height
      });
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Camera capture failed. Try again or choose a photo.");
    } finally {
      setCapturing(false);
    }
  }

  const shutterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }]
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value
  }));

  async function pickFromGallery() {
    setError(null);
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        setError("Photo library permission was denied. You can still use the camera, or enable photo access in settings.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        base64: true
      });

      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) {
        setError("The selected image could not be opened. Try a different photo.");
        return;
      }
      setManualMode(false);
      setCaptured({
        uri: asset.uri,
        base64: asset.base64 ?? null,
        mimeType: asset.mimeType ?? "image/jpeg",
        fileName: asset.fileName ?? `photo-document-${Date.now()}.jpg`,
        width: asset.width,
        height: asset.height
      });
    } catch (pickerError) {
      setError(toFriendlyNetworkError(pickerError, "Could not open the photo library."));
    }
  }

  async function pickPdf() {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) {
        setError("The selected PDF could not be opened. Try a different file.");
        return;
      }
      setManualMode(false);
      setCaptured({
        uri: asset.uri,
        base64: null,
        mimeType: "application/pdf",
        fileName: asset.name || `vendor-document-${Date.now()}.pdf`,
        width: null,
        height: null
      });
    } catch (pickerError) {
      setError(toFriendlyNetworkError(pickerError, "Could not open the document picker."));
    }
  }

  async function usePhoto() {
    setError(null);
    setManualDocumentId(null);
    if (!captured && !manualMode) return;
    if (!documentType) {
      setError("Choose COI, license, or W-9 before uploading.");
      return;
    }
    if (!selectedRequirement) {
      setError("Choose the vendor requirement this document satisfies.");
      return;
    }

    try {
      if (manualMode) {
        setUploadStep("creating_record");
        const documentId = await createManualReviewDocument({
          documentType,
          requirement: selectedRequirement,
          reason: "Created through the manual-entry fallback."
        });
        setUploadStep(null);
        router.replace(`/documents/${documentId}`);
        return;
      }
      if (!captured) return;
      const result = await uploadCapturedDocument({
        source: captured,
        documentType,
        requirement: selectedRequirement,
        onStep: setUploadStep
      });

      setUploadStep(null);
      if (result.extractionError) {
        setManualDocumentId(result.documentId);
        setError(`Uploaded, but AI extraction needs manual review: ${result.extractionError}`);
        return;
      }
      router.replace(`/documents/${result.documentId}`);
    } catch (uploadError) {
      setUploadStep(null);
      setError(toFriendlyNetworkError(uploadError, "Upload failed. Try again or enter the document manually."));
    }
  }

  async function retryExtraction() {
    if (!captured || !manualDocumentId || !documentType) return;
    setError(null);
    try {
      const result = await retryCapturedDocumentExtraction({
        documentId: manualDocumentId,
        source: captured,
        documentType,
        onStep: setUploadStep
      });
      setUploadStep(null);
      if (result.extractionError) {
        setError(`AI extraction still needs manual review: ${result.extractionError}`);
        return;
      }
      router.replace(`/documents/${result.documentId}`);
    } catch (retryError) {
      setUploadStep(null);
      setError(toFriendlyNetworkError(retryError, "Extraction retry failed. You can retry again or enter fields manually."));
    }
  }

  if (!permission?.granted) {
    const blocked = permission && !permission.canAskAgain;
    return (
      <View style={styles.permissionScreen}>
        <View style={styles.permissionCard}>
          <MaterialCommunityIcons name="camera-outline" size={36} color={colors.accent} />
          <Text variant="headline">Camera Access</Text>
          <Text variant="muted">VendorProof uses the camera to capture compliance documents for review.</Text>
          {error ? <Text className="text-missing">{error}</Text> : null}
          <Button onPress={blocked ? Linking.openSettings : requestCamera}>{blocked ? "Open Settings" : "Allow Camera"}</Button>
          <Button variant="secondary" onPress={pickFromGallery}>
            Choose From Photos
          </Button>
          <Button variant="secondary" onPress={pickPdf}>
            Choose PDF
          </Button>
          <Button variant="secondary" onPress={() => setManualMode(true)}>
            Enter Fields Manually
          </Button>
          <Button variant="ghost" onPress={() => router.back()}>
            Cancel
          </Button>
        </View>
      </View>
    );
  }

  if (captured || manualMode) {
    return (
      <View style={styles.previewRoot}>
        <ScrollView contentContainerStyle={styles.previewContent}>
          <View style={styles.previewHeader}>
            <Button
              variant="ghost"
              className="items-start px-0"
              disabled={busy}
              onPress={() => {
                setCaptured(null);
                setManualMode(false);
              }}
            >
              {manualMode ? "Back" : "Retake"}
            </Button>
            <Text variant="title">{manualMode ? "Manual Entry" : "Preview"}</Text>
            <Button variant="ghost" className="items-start px-0" disabled={busy} onPress={() => router.back()}>
              Close
            </Button>
          </View>

          {manualMode ? (
            <View style={styles.pdfPreview}>
              <MaterialCommunityIcons name="form-textbox" size={52} color={colors.accent} />
              <Text variant="title">Create a manual review</Text>
              <Text variant="muted">Choose the document type and vendor requirement. You can enter every field on the next screen.</Text>
            </View>
          ) : captured?.mimeType === "application/pdf" ? (
            <View style={styles.pdfPreview}>
              <MaterialCommunityIcons name="file-pdf-box" size={52} color={colors.accent} />
              <Text variant="title">{captured.fileName}</Text>
              <Text variant="muted">PDF pages will be rendered and OCR-processed securely before extraction.</Text>
            </View>
          ) : (
            <Image source={{ uri: captured!.uri }} style={styles.previewImage} resizeMode="contain" />
          )}

          <View style={styles.panel}>
            <Text variant="title">Document Type</Text>
            <Text variant="muted">Required before upload</Text>
            <View style={styles.segmentRow}>
              {documentTypes.map((type) => {
                const active = documentType === type.value;
                return (
                  <Pressable key={type.value} style={[styles.segment, active && styles.segmentActive]} disabled={busy} onPress={() => setDocumentType(type.value)}>
                    <Text className={active ? "text-accent-foreground font-semibold" : "text-muted"}>{type.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.panel}>
            <Text variant="title">Vendor Requirement</Text>
            <Text variant="muted">{loading ? "Loading synced requirements..." : "Select where this document should attach"}</Text>
            <View style={styles.requirementList}>
              {requirements.map(({ requirement, vendorName, propertyName }) => (
                <RequirementOption
                  key={requirement.id}
                  active={requirement.id === requirementId}
                  disabled={busy}
                  requirement={requirement}
                  vendorName={vendorName}
                  propertyName={propertyName}
                  onPress={() => setRequirementId(requirement.id)}
                />
              ))}
              {!loading && requirements.length === 0 ? (
                <EmptyState icon="clipboard-alert-outline" title="No requirements yet" message="A vendor requirement is needed before a document can be attached." actionLabel="Return to Vendors" onAction={() => router.replace("/(tabs)/vendors")} />
              ) : null}
            </View>
          </View>

          {uploadStep ? (
            <View style={styles.progressBox}>
              <ActivityIndicator color={colors.accent} />
              <Text>{stepLabels[uploadStep]}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text className="text-missing">{error}</Text>
              {manualDocumentId ? (
                <>
                  <Button disabled={busy} onPress={retryExtraction}>
                    Retry AI Extraction
                  </Button>
                  <Button variant="secondary" disabled={busy} onPress={() => router.replace(`/documents/${manualDocumentId}`)}>
                    Enter Fields Manually
                  </Button>
                </>
              ) : null}
            </View>
          ) : null}

          <Button disabled={busy || !documentType || !selectedRequirement} onPress={usePhoto}>
            {uploadStep ? stepLabels[uploadStep] : manualMode ? "Continue to Manual Entry" : "Use This Photo"}
          </Button>
          {!manualMode ? (
            <>
              <Button variant="secondary" disabled={busy} onPress={pickFromGallery}>
                Choose Different Photo
              </Button>
              <Button variant="secondary" disabled={busy} onPress={pickPdf}>
                Choose PDF
              </Button>
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <Animated.View pointerEvents="none" style={[styles.flash, flashStyle]} />
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable style={styles.closeButton} disabled={capturing} onPress={() => router.back()}>
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

        {error ? (
          <View style={styles.cameraError}>
            <Text className="text-missing">{error}</Text>
            <Button variant="secondary" disabled={capturing} onPress={() => setManualMode(true)}>
              Enter Fields Manually
            </Button>
          </View>
        ) : null}

        <View style={styles.bottomPanel}>
          <View style={styles.captureRow}>
            <AnimatedPressable style={styles.galleryButton} disabled={capturing} onPress={pickFromGallery}>
              <MaterialCommunityIcons name="image-outline" size={24} color={colors.foreground} />
            </AnimatedPressable>
            <Pressable style={styles.shutter} disabled={capturing} onPress={capturePhoto}>
              <Animated.View style={[styles.shutterVisual, shutterAnimatedStyle]}>
                {capturing ? <ActivityIndicator color={colors.accentForeground} /> : <View style={styles.shutterInner} />}
              </Animated.View>
            </Pressable>
            <AnimatedPressable style={styles.galleryButton} disabled={capturing} onPress={pickPdf}>
              <MaterialCommunityIcons name="file-pdf-box" size={24} color={colors.foreground} />
            </AnimatedPressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function RequirementOption({
  requirement,
  vendorName,
  propertyName,
  active,
  disabled,
  onPress
}: {
  requirement: VendorRequirementRecord;
  vendorName: string;
  propertyName: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable style={[styles.requirementOption, active && styles.requirementOptionActive]} disabled={disabled} onPress={onPress}>
      <View style={styles.requirementCopy}>
        <Text variant="title">{vendorName}</Text>
        <Text variant="muted">
          {propertyName} - {requirement.name || requirement.document_type}
        </Text>
      </View>
      {active ? <MaterialCommunityIcons name="check-circle" size={22} color={colors.accent} /> : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  permissionScreen: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: colors.background
  },
  permissionCard: {
    gap: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18
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
  flash: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(247, 248, 251, 0.92)",
    zIndex: 1
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
    right: -2,
    bottom: -2,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderBottomRightRadius: 18
  },
  cameraError: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(253, 164, 175, 0.3)",
    backgroundColor: "rgba(5, 7, 13, 0.88)",
    padding: 12
  },
  bottomPanel: {
    paddingBottom: 28
  },
  captureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around"
  },
  galleryButton: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 13, 22, 0.82)"
  },
  shutter: {
    width: 82,
    height: 82,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  shutterVisual: {
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
  },
  previewRoot: {
    flex: 1,
    backgroundColor: colors.background
  },
  previewContent: {
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 28
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  previewImage: {
    width: "100%",
    height: 360,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input
  },
  pdfPreview: {
    minHeight: 240,
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.input,
    padding: 20
  },
  panel: {
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8
  },
  segment: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.input
  },
  segmentActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  requirementList: {
    gap: 8
  },
  requirementOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    padding: 12
  },
  requirementOptionActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(34, 242, 210, 0.08)"
  },
  requirementCopy: {
    flex: 1,
    gap: 3
  },
  progressBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(34, 242, 210, 0.28)",
    backgroundColor: "rgba(34, 242, 210, 0.08)",
    padding: 12
  },
  errorBox: {
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(253, 164, 175, 0.3)",
    backgroundColor: "rgba(253, 164, 175, 0.08)",
    padding: 12
  }
});
