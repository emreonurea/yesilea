import { Pressable, Share, Text, View } from "react-native";
import { router } from "expo-router";
import { AISLE_LABELS, COST_NOTE, formatQty, formatTry } from "@menu/shared";
import { api, type ShoppingResponse } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useLoad } from "../../lib/useLoad";
import { Button, Card, colors, Disclaimer, ErrorText, Loading, Muted, s, Screen } from "../../components/ui";

function listText(l: ShoppingResponse) {
  return l.groups
    .map((g) => `${AISLE_LABELS[g.aisle]}\n${g.items.filter((i) => !i.checked).map((i) => `- ${i.name}: ${formatQty(i.qty, i.unit)}`).join("\n")}`)
    .join("\n\n");
}

export default function ShoppingList() {
  const { me } = useAuth();
  const { data: list, setData, error, setError, loading } = useLoad(api.shopping);

  async function toggle(key: string, checked: boolean) {
    if (!list) return;
    // Önce ekranda işaretle, sonra sunucuya gönder.
    setData({ ...list, groups: list.groups.map((g) => ({ ...g, items: g.items.map((i) => (i.key === key ? { ...i, checked } : i)) })) });
    try {
      setData(await api.check(key, checked));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading && list === undefined) return <Loading />;
  if (!list) {
    return (
      <Screen>
        <Muted style={{ marginBottom: 12 }}>Market listesi haftalık menüden hazırlanır. Önce bir menü oluşturun.</Muted>
        <Button title="Menüye git" onPress={() => router.push("/menu")} />
      </Screen>
    );
  }

  const { cost, budget_try } = list;
  const over = budget_try != null && cost.total_try > budget_try;

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
          {cost.label === "tahmini" ? "Maliyet: fiyat girilmedi" : `${cost.label === "hesaplandı" ? "Toplam" : "Tahmini toplam (en az)"}: ${formatTry(cost.total_try)}`}
        </Text>
        {budget_try != null ? (
          <Muted style={{ color: over ? colors.danger : colors.muted, marginTop: 4 }}>
            Haftalık bütçe: {formatTry(budget_try)}{over ? " · bütçe aşılıyor" : ""}
          </Muted>
        ) : null}
        {cost.unpriced.length ? <Muted style={{ marginTop: 4 }}>Fiyatı girilmemiş {cost.unpriced.length} kalem toplama dahil değil.</Muted> : null}
        <Muted style={{ marginTop: 4, fontSize: 12 }}>{COST_NOTE}</Muted>
        <Pressable onPress={() => router.push("/prices")}><Text style={{ color: colors.primary, marginTop: 8 }}>Birim fiyatları düzenle</Text></Pressable>
      </Card>

      {list.groups.map((g) => (
        <View key={g.aisle} style={{ marginBottom: 8 }}>
          <Text style={[s.label, { marginTop: 8 }]}>{AISLE_LABELS[g.aisle]}</Text>
          {g.items.map((i) => (
            <Pressable key={i.key} onPress={() => toggle(i.key, !i.checked)} accessibilityRole="checkbox" accessibilityState={{ checked: i.checked }}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 20, marginRight: 10, color: i.checked ? colors.ok : colors.muted }}>{i.checked ? "☑" : "☐"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: i.checked ? colors.muted : colors.text, textDecorationLine: i.checked ? "line-through" : "none" }}>{i.name}</Text>
                <Muted style={{ fontSize: 12 }}>{formatQty(i.qty, i.unit)}</Muted>
              </View>
            </Pressable>
          ))}
        </View>
      ))}

      <ErrorText error={error} />
      <Button title="Listeyi paylaş" kind="secondary" onPress={() => Share.share({ message: listText(list) })} />
      <Disclaimer halal={me?.profile.halal_sensitive} />
    </Screen>
  );
}
