import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

/** Ekran her açıldığında veriyi yükler. */
export function useLoad<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { data, setData, error, setError, loading, reload };
}
