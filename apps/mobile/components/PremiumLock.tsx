import { Text } from "react-native";
import { router } from "expo-router";
import { Button, Card, colors, Muted } from "./ui";

/** Premium gerektiren bölümlerde gösterilen kilit kartı. */
export function PremiumLock({ title, text }: { title: string; text: string }) {
  return (
    <Card style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}>
      <Text style={{ fontSize: 28 }}>🔒</Text>
      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, marginTop: 4 }}>{title}</Text>
      <Muted style={{ marginVertical: 6 }}>{text}</Muted>
      <Button title="Premium'u incele" onPress={() => router.push("/premium")} />
    </Card>
  );
}

/** Ücretsiz hak dolduğunda (402) gösterilecek bağlantı. */
export function QuotaHint({ code }: { code: string | null }) {
  if (code !== "quota") return null;
  return <Button title="Sınırsız kullanım için Premium" kind="secondary" onPress={() => router.push("/premium")} />;
}
