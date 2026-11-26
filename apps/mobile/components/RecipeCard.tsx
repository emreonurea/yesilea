import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import type { Recipe } from "@menu/shared";
import { colors, Muted } from "./ui";

export function HalalBadge({ status }: { status: Recipe["halal_status"] }) {
  if (status === "uygun") return null;
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: status === "uyarlanmış" ? "#E0F2FE" : "#FEF3C7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 }}>
      <Text style={{ fontSize: 12, color: colors.text }}>{status === "uyarlanmış" ? "Uyarlanmış tarif" : "Helal: kontrol gerekli"}</Text>
    </View>
  );
}

export function RecipeRow({ recipe, label, right }: { recipe: Recipe & { id: string }; label?: string; right?: ReactNode }) {
  return (
    <Pressable onPress={() => router.push(`/recipe/${recipe.id}`)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8 }}>
      <View style={{ flex: 1 }}>
        {label ? <Muted style={{ fontSize: 12 }}>{label}</Muted> : null}
        <Text style={{ fontSize: 16, color: colors.text, fontWeight: "500" }}>{recipe.name_tr}</Text>
        <Muted style={{ fontSize: 12 }}>{recipe.prep_min + recipe.cook_min} dk · {recipe.difficulty}</Muted>
        <HalalBadge status={recipe.halal_status} />
      </View>
      {right}
    </Pressable>
  );
}
