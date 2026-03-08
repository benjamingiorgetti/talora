"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import useSWR from "swr";
import { fetcher, api } from "@/lib/api";
import { toast } from "sonner";

export function usePromptEditor() {
  const {
    data: serverPrompt,
    error,
    isLoading,
    mutate,
  } = useSWR<string>("/agent/prompt", async (path: string) => {
    const res = await api.get<{ data: { prompt: string } }>(path);
    return res.data.prompt;
  });

  const [localPrompt, setLocalPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const initializedRef = useRef(false);

  // Initialize local state from server data once
  useEffect(() => {
    if (serverPrompt !== undefined && !initializedRef.current) {
      initializedRef.current = true;
      setLocalPrompt(serverPrompt);
    }
  }, [serverPrompt]);

  const isDirty = serverPrompt !== undefined && localPrompt !== serverPrompt;

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      await api.put("/agent/prompt", { prompt: localPrompt });
      await mutate();
      initializedRef.current = false;
      toast.success("Cambios guardados");
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar los cambios");
    } finally {
      setIsSaving(false);
    }
  }, [localPrompt, mutate]);

  const discard = useCallback(() => {
    if (serverPrompt !== undefined) {
      setLocalPrompt(serverPrompt);
    }
  }, [serverPrompt]);

  return {
    localPrompt,
    setLocalPrompt,
    error,
    isLoading: isLoading && serverPrompt === undefined,
    isSaving,
    isDirty,
    save,
    discard,
    mutate,
  };
}
