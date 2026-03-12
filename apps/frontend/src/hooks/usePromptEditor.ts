"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
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
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [promptSavedAt, setPromptSavedAt] = useState<number | null>(null);

  // Sync local state from server when server data changes and user hasn't edited
  useEffect(() => {
    if (serverPrompt !== undefined && !hasLocalEdits) {
      setLocalPrompt(serverPrompt);
    }
  }, [serverPrompt, hasLocalEdits]);

  const handleSetLocalPrompt = useCallback((value: string) => {
    setLocalPrompt(value);
    setHasLocalEdits(true);
  }, []);

  const isDirty = serverPrompt !== undefined && localPrompt !== serverPrompt;

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await api.put<{ data: { prompt: string } }>("/agent/prompt", { prompt: localPrompt });
      const savedPrompt = res.data.prompt;
      // Optimistic update with the confirmed saved value
      await mutate(savedPrompt, { revalidate: false });
      setHasLocalEdits(false);
      setPromptSavedAt(Date.now());
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
      setHasLocalEdits(false);
    }
  }, [serverPrompt]);

  return {
    localPrompt,
    setLocalPrompt: handleSetLocalPrompt,
    error,
    isLoading: isLoading && serverPrompt === undefined,
    isSaving,
    isDirty,
    save,
    discard,
    mutate,
    promptSavedAt,
  };
}
