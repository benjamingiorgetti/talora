"use client";

import { useRef, useCallback, useState } from "react";
import { usePromptEditor } from "@/hooks/usePromptEditor";
import { SaveDiscardBar } from "./save-discard-bar";
import { TestChatPanel } from "./test-chat-panel";
import { EnvironmentToggle } from "./environment-toggle";
import { ResolvedView } from "./resolved-view";
import { ErrorCard } from "@/components/ui/error-card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { FileText, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Panel, Group, Separator } from "react-resizable-panels";

function highlightVariables(text: string) {
  // Split text around {{variable}} patterns
  const parts = text.split(/({{[^}]*}})/g);
  return parts.map((part, i) => {
    if (part.startsWith("{{") && part.endsWith("}}")) {
      return (
        <mark
          key={i}
          style={{
            all: "unset",
            backgroundColor: "hsl(var(--primary) / 0.15)",
            color: "hsl(var(--primary))",
            borderRadius: "2px",
            padding: "0 2px",
          }}
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}

export function PromptEditorTab() {
  const {
    localPrompt,
    setLocalPrompt,
    error,
    isLoading,
    isSaving,
    isDirty,
    save,
    discard,
    mutate,
    promptSavedAt,
  } = usePromptEditor();

  const [mode, setMode] = useState<"production" | "test">("production");
  const [showResolved, setShowResolved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  if (error) return <ErrorCard onRetry={() => mutate()} />;
  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="flex flex-col gap-0">
      {/* Top toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <EnvironmentToggle mode={mode} onChange={setMode} />
          <h2 className="text-xl font-semibold tracking-tight">
            Prompt Editor
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowResolved((v) => !v)}
          className={cn(
            "h-8 text-xs gap-1.5 transition-colors",
            showResolved && "bg-accent text-foreground border-border"
          )}
          aria-pressed={showResolved}
        >
          {showResolved ? (
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {showResolved ? "Ocultar vista resuelta" : "Vista Resuelta"}
        </Button>
      </div>

      {/* Main layout */}
      <Group orientation="horizontal" id="prompt-editor" className="flex-1">
        <Panel defaultSize={60} minSize={30}>
          <AnimatePresence mode="wait">
            {showResolved ? (
              <motion.div
                key="resolved"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{ minHeight: "500px" }}
              >
                <ResolvedView isOpen={showResolved} />
              </motion.div>
            ) : (
              <motion.div
                key="editor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                {/* Highlighted editor: backdrop div + transparent textarea overlay */}
                <div
                  className="relative rounded-lg border border-border bg-card overflow-hidden"
                  style={{ minHeight: "400px", maxHeight: "600px", height: "600px" }}
                >
                  {/* Backdrop: renders highlighted text */}
                  <div
                    ref={backdropRef}
                    className="absolute inset-0 p-4 overflow-auto pointer-events-none font-mono text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground/90"
                    aria-hidden="true"
                  >
                    {highlightVariables(localPrompt)}
                    {/* Extra space so backdrop always has room for trailing newline */}
                    {"\n"}
                  </div>

                  {/* Textarea: transparent text, visible caret */}
                  <textarea
                    ref={textareaRef}
                    value={localPrompt}
                    onChange={(e) => setLocalPrompt(e.target.value)}
                    onScroll={handleScroll}
                    className="absolute inset-0 w-full h-full p-4 font-mono text-sm leading-relaxed resize-none bg-transparent outline-none whitespace-pre-wrap break-words"
                    style={{
                      color: "transparent",
                      caretColor: "hsl(var(--foreground))",
                    }}
                    spellCheck={false}
                    placeholder="Escribi tu prompt aca... Usa {{variables}} para insertar valores dinamicos."
                  />
                </div>

                {/* Empty state hint */}
                {!localPrompt && (
                  <div className="flex items-center gap-2 mt-3 px-1">
                    <FileText className="h-4 w-4 text-muted-foreground/40" aria-hidden="true" />
                    <p className="text-xs text-muted-foreground">
                      Escribi el prompt del agente. Podes usar variables como{" "}
                      <code className="font-mono text-primary bg-primary/10 px-1 rounded">
                        {"{{nombreCliente}}"}
                      </code>{" "}
                      que se reemplazan automaticamente.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>
        <Separator className="w-1.5 mx-1 rounded-full bg-border/50 hover:bg-primary/30 transition-colors cursor-col-resize" />
        <Panel defaultSize={40} minSize={20}>
          <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col h-full">
            <TestChatPanel promptSavedAt={promptSavedAt} />
          </div>
        </Panel>
      </Group>

      {/* Save/discard bar */}
      <SaveDiscardBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={save}
        onDiscard={discard}
      />
    </div>
  );
}
