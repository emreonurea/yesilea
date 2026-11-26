import { useState } from "react";
import { Alert, Pressable, Text } from "react-native";
import { DAY_LABELS, dayTotal, MEAL_SLOT_LABELS, MEAL_SLOTS, type MealSlot } from "@menu/shared";
import { MacroLine } from "../../components/NutritionBars";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { QuotaHint } from "../../components/PremiumLock";
import { ApiError } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { Button, Card, colors, Disclaimer, ErrorText, Loading, Muted, Screen, Title } from "../../components/ui";
import { RecipeRow } from "../../components/RecipeCard";

export default function Menu() {
  const { me, refresh } = useAuth();
  const { data: plan, setData, error, setError, loading } = useLoad(api.currentPlan);
  const [busy, setBusy] = useState<string | null>(null);
  const [errCode, setErrCode] = useState<string | null>(null);

  async function create(fresh: boolean) {
    setBusy("plan");
    setError(null);
    setErrCode(null);
    try {
      setData(await api.newPlan(fresh));
      refresh();
    } catch (e) {
      setError((e as Error).message);
      setErrCode(e instanceof ApiError ? e.code : null);
    } finally {
      setBusy(null);
    }
  }

  async function swap(day: number, slot: MealSlot) {
    if (!plan) return;
    setBusy(`${day}-${slot}`);
    setError(null);
    setErrCode(null);
    try {
      setData(await api.swap(plan.id, day, slot));
      refresh();
    } catch (e) {
      setError((e as Error).message);
      setErrCode(e instanceof ApiError ? e.code : null);
    } finally {
      setBusy(null);
    }
  }

  const confirmNew = () =>
    Alert.alert("Yeni menü", "Mevcut menünün yerine yenisi hazırlansın mı?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Hazırla", onPress: () => create(true) },
    ]);

  if (loading && plan === undefined) return <Loading />;
  const u = me?.usage.plan;

  return (
    <Screen>
      {!plan ? (
        <>
          <Title>Haftalık menü</Title>
          <Muted style={{ marginBottom: 16 }}>Bütçenize, evdeki malzemelere ve tercihlerinize göre 7 günlük menü hazırlayalım. Bu işlem bir dakika kadar sürebilir.</Muted>
          <Button title="Menü hazırla" onPress={() => create(false)} loading={busy === "plan"} />
        </>
      ) : (
        <>
          <Muted style={{ marginBottom: 8 }}>{plan.week_start} haftası · {plan.servings} kişilik</Muted>
          {plan.days.map((d) => (
            <Card key={d.day}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>{DAY_LABELS[d.day - 1]}</Text>
              {(() => {
                const { total, missing } = dayTotal(MEAL_SLOTS.map((sl) => d[sl]));
                return missing < 3 ? <MacroLine n={total} /> : null;
              })()}
              {MEAL_SLOTS.map((slot) => (
                <RecipeRow
                  key={slot}
                  recipe={d[slot]}
                  label={MEAL_SLOT_LABELS[slot]}
                  right={
                    <Pressable onPress={() => swap(d.day, slot)} disabled={!!busy} hitSlop={8} accessibilityLabel={`${MEAL_SLOT_LABELS[slot]} yemeğini değiştir`}>
                      <Text style={{ color: busy === `${d.day}-${slot}` ? colors.muted : colors.primary }}>
                        {busy === `${d.day}-${slot}` ? "…" : "Değiştir"}
                      </Text>
                    </Pressable>
                  }
                />
              ))}
            </Card>
          ))}
          <Button title="Yeni menü hazırla" kind="secondary" onPress={confirmNew} loading={busy === "plan"} />
        </>
      )}
      <ErrorText error={error} />
      <QuotaHint code={errCode} />
      {u && u.limit != null ? <Muted>Bu hafta kalan menü hakkı: {Math.max(0, u.limit - u.used)}</Muted> : null}
      <Disclaimer halal={me?.profile.halal_sensitive} />
    </Screen>
  );
}

