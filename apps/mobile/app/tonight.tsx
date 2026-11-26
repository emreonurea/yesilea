import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { api, type StoredRecipe } from "../lib/api";
import { useAuth } from "../lib/auth";
import { QuotaHint } from "../components/PremiumLock";
import { ApiError } from "../lib/api";
import { Button, Card, colors, Disclaimer, ErrorText, Muted, Screen, Title } from "../components/ui";
import { HalalBadge } from "../components/RecipeCard";

export default function Tonight() {
  const { me, refresh } = useAuth();
  const [recipe, setRecipe] = useState<StoredRecipe | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errCode, setErrCode] = useState<string | null>(null);

  async function suggest(another: boolean) {
    setBusy(true);
    setError(null);
    setErrCode(null);
    try {
      const exclude = another && recipe ? [...seen, recipe.name_tr] : [];
      const r = await api.tonight(exclude);
      setSeen(exclude);
      setRecipe(r);
      refresh();
    } catch (e) {
      setError((e as Error).message);
      setErrCode(e instanceof ApiError ? e.code : null);
    } finally {
      setBusy(false);
    }
  }

  const u = me?.usage.tonight;
  return (
    <Screen>
      <Title>Bu akşam ne pişirsem?</Title>
      {!recipe ? (
        <>
          <Muted style={{ marginBottom: 16 }}>Evdeki malzemelerinize ve tercihlerinize göre tek bir akşam yemeği önerelim.</Muted>
          <Button title="Öneri al" onPress={() => suggest(false)} loading={busy} />
        </>
      ) : (
        <>
          <Card>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>{recipe.name_tr}</Text>
            <Muted style={{ marginTop: 4 }}>{recipe.description}</Muted>
            <Muted style={{ marginTop: 8 }}>{recipe.prep_min + recipe.cook_min} dakika · {recipe.servings} kişilik · {recipe.difficulty}</Muted>
            <HalalBadge status={recipe.halal_status} />
            <View style={{ marginTop: 12 }}>
              <Button title="Tarifi aç" onPress={() => router.push(`/recipe/${recipe.id}`)} />
              <Button title="Başka öner" kind="secondary" onPress={() => suggest(true)} loading={busy} />
            </View>
          </Card>
        </>
      )}
      <ErrorText error={error} />
      <QuotaHint code={errCode} />
      {u && u.limit != null ? <Muted style={{ marginTop: 8 }}>Bugün kalan öneri hakkı: {Math.max(0, u.limit - u.used)}</Muted> : null}
      <Disclaimer halal={me?.profile.halal_sensitive} />
    </Screen>
  );
}
