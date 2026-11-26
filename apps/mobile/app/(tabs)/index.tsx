import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { DAY_LABELS, MEAL_SLOT_LABELS, MEAL_SLOTS } from "@menu/shared";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useLoad } from "../../lib/useLoad";
import { colors, Muted } from "../../components/ui";

interface Tile {
  title: string;
  subtitle: string;
  emoji: string;
  bg: string;
  href: string;
}

const TILES: Tile[] = [
  { title: "Premium", subtitle: "Sınırsız + diyet", emoji: "👑", bg: "#FDE68A", href: "/premium" },
  { title: "Haftalık menü", subtitle: "7 günlük plan", emoji: "📅", bg: "#E0F2FE", href: "/menu" },
  { title: "Market listesi", subtitle: "Reyonlara göre", emoji: "🛒", bg: "#DCFCE7", href: "/list" },
  { title: "Evdekiler", subtitle: "Malzemelerim", emoji: "🧺", bg: "#FEF3C7", href: "/pantry" },
  { title: "Diyet programım", subtitle: "Boy, kilo, hedef", emoji: "⚖️", bg: "#F3E8FF", href: "/body" },
  { title: "Kalori takibi", subtitle: "Ne yedim, makrolar", emoji: "🔥", bg: "#ECFCCB", href: "/nutrition" },
  { title: "Diyet yemekleri", subtitle: "Düşük kalori, yüksek protein", emoji: "🥦", bg: "#D1FAE5", href: "/diet-recipes" },
  { title: "Yemeklerim", subtitle: "Kendi tariflerim", emoji: "🍳", bg: "#FFEDD5", href: "/my-recipes" },
  { title: "Notlarım", subtitle: "Fikirler, hatırlatmalar", emoji: "📝", bg: "#FEF9C3", href: "/notes" },
  { title: "Birim fiyatlar", subtitle: "Maliyet hesabı", emoji: "💰", bg: "#FFE4E6", href: "/prices" },
  { title: "Profilim", subtitle: "Hane, alerji, diyet", emoji: "👤", bg: "#E0E7FF", href: "/profile" },
  { title: "Ayarlar", subtitle: "Renk, hesap, gizlilik", emoji: "⚙️", bg: "#F1F5F9", href: "/settings" },
  ];

/** Bugün: 1 = Pazartesi ... 7 = Pazar */
const todayIndex = () => ((new Date().getDay() + 6) % 7) + 1;

export default function Home() {
  const { me } = useAuth();
  const { data: plan } = useLoad(api.currentPlan);
  const { data: pantry } = useLoad(api.pantry);
  const soon = (pantry ?? []).filter((p) => p.expires_on && (new Date(p.expires_on).getTime() - Date.now()) / 86400000 <= 3);
  const { width } = useWindowDimensions();
  const tileW = (width - 16 * 2 - 12) / 2;
  const today = plan?.days.find((d) => d.day === todayIndex());
  const t = me?.targets;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text }}>Yeşilea</Text>
        <Muted style={{ marginBottom: 16 }}>{me?.premium ? "👑 Premium · " : ""}{DAY_LABELS[todayIndex() - 1]}{t ? ` · günlük hedef ${t.kcal} kcal` : ""}</Muted>

        {/* Büyük kutucuk: bu akşam */}
        <Pressable onPress={() => router.push("/tonight")} style={({ pressed }) => ({
          backgroundColor: colors.primary, borderRadius: 20, padding: 20, marginBottom: 12, opacity: pressed ? 0.9 : 1,
        })}>
          <Text style={{ fontSize: 34 }}>🍲</Text>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 6 }}>Bu akşam ne pişirsem?</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 4 }}>Evdekilerle tek dokunuşla öneri al</Text>
        </Pressable>

        {/* Bugünün menüsü */}
        {today ? (
          <Pressable onPress={() => router.push("/menu")} style={{ backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontWeight: "700", color: colors.text, marginBottom: 6 }}>Bugünün menüsü</Text>
            {MEAL_SLOTS.map((s) => (
              <Text key={s} style={{ color: colors.text, paddingVertical: 2 }}>
                <Text style={{ color: colors.muted }}>{MEAL_SLOT_LABELS[s]}: </Text>{today[s].name_tr}
              </Text>
            ))}
          </Pressable>
        ) : null}

        {soon.length ? (
          <Pressable onPress={() => router.push("/pantry")} style={{ backgroundColor: "#FEF2F2", borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#FECACA" }}>
            <Text style={{ fontWeight: "700", color: "#991B1B" }}>⏰ Son kullanma tarihi yaklaşanlar</Text>
            <Text style={{ color: colors.text, marginTop: 4 }}>{soon.map((p) => p.name).join(", ")}</Text>
            <Muted style={{ fontSize: 12, marginTop: 2 }}>"Bu akşam ne pişirsem" önerileri bunları önce kullanır.</Muted>
          </Pressable>
        ) : null}

        {/* Kutucuklar */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {TILES.map((tile) => (
            <Pressable key={tile.title} onPress={() => router.push(tile.href)} accessibilityRole="button"
              style={({ pressed }) => ({
                width: tileW, height: tileW * 0.85, backgroundColor: tile.bg, borderRadius: 18, padding: 14, marginBottom: 12,
                justifyContent: "space-between", opacity: pressed ? 0.85 : 1,
              })}>
              <Text style={{ fontSize: 30 }}>{tile.emoji}</Text>
              <View>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{tile.title}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{tile.subtitle}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
