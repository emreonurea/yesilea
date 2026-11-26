import { Pressable, ScrollView, Text } from "react-native";

/** Bir ekran açılırken hata olursa boş kalmak yerine nedenini gösterir. */
export function ErrorScreen({ error, retry }: { error: Error; retry: () => Promise<void> | void }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60, backgroundColor: "#fff", flexGrow: 1 }}>
      <Text style={{ fontSize: 20, fontWeight: "700", color: "#2B2620" }}>Bu ekran açılamadı</Text>
      <Text style={{ marginTop: 8, color: "#7A7067" }}>Bu yazının ekran görüntüsünü gönderirseniz sorun düzeltilir.</Text>
      <Text selectable style={{ marginTop: 16, color: "#B91C1C", fontFamily: "monospace", fontSize: 13 }}>
        {String(error?.message ?? error)}
        {"\n\n"}
        {String(error?.stack ?? "").split("\n").slice(0, 6).join("\n")}
      </Text>
      <Pressable onPress={() => retry()} style={{ marginTop: 24 }}>
        <Text style={{ color: "#15803D", fontSize: 17, fontWeight: "600" }}>Tekrar dene</Text>
      </Pressable>
    </ScrollView>
  );
}
