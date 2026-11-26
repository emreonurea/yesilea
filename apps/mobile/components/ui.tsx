import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DISCLAIMER_HALAL, DISCLAIMER_MEDICAL } from "@menu/shared";

export const colors = {
  bg: "#F6FBF7",
  card: "#FFFFFF",
  text: "#2B2620",
  muted: "#7A7067",
  primary: "#15803D",
  primarySoft: "#DCFCE7",
  border: "#E9E1D6",
  danger: "#B91C1C",
  ok: "#15803D",
};

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["left", "right"]}>
      {scroll ? <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">{children}</ScrollView> : <View style={[s.screen, { flex: 1 }]}>{children}</View>}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({ title, onPress, kind = "primary", loading, disabled }: {
  title: string; onPress: () => void; kind?: "primary" | "secondary" | "danger"; loading?: boolean; disabled?: boolean;
}) {
  const bg = kind === "primary" ? colors.primary : kind === "danger" ? colors.danger : colors.primarySoft;
  const fg = kind === "secondary" ? colors.primary : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityState={{ selected }}
      style={[s.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <Text style={{ color: selected ? "#fff" : colors.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...props} style={[s.input, props.style]} />
    </View>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? <Text style={{ color: colors.danger, marginVertical: 8 }}>{error}</Text> : null;
}

export function Loading() {
  return <View style={{ padding: 32 }}><ActivityIndicator color={colors.primary} /></View>;
}

/** Her tarif, menü ve liste ekranında gösterilen uyarılar. */
export function Disclaimer({ halal }: { halal?: boolean }) {
  return (
    <View style={s.disclaimer}>
      <Text style={s.disclaimerText}>{DISCLAIMER_MEDICAL}</Text>
      {halal ? <Text style={[s.disclaimerText, { marginTop: 4 }]}>{DISCLAIMER_HALAL}</Text> : null}
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 12 },
  muted: { color: colors.muted, fontSize: 14 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  btn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", marginVertical: 6 },
  btnText: { fontSize: 16, fontWeight: "600" },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 8, backgroundColor: "#fff" },
  label: { fontSize: 14, color: colors.muted, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: "#fff", color: colors.text },
  row: { flexDirection: "row", alignItems: "center" },
  wrap: { flexDirection: "row", flexWrap: "wrap" },
  disclaimer: { marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: "#F3EEE7" },
  disclaimerText: { fontSize: 12, color: colors.muted },
});
