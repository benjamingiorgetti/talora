"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResolvedViewProps {
  isOpen: boolean;
}

function formatResolvedPrompt(text: string) {
  // Split on section separators like "---" or double newlines before headings
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Section headers (lines that look like titles — all caps or ending with ":")
    const isSectionHeader =
      /^[A-Z][A-Z\s]+:?$/.test(line.trim()) ||
      /^\d+\.\s+[A-Z]/.test(line.trim()) ||
      /^#{1,3}\s/.test(line.trim());

    const isVariableLine = line.includes("{{") && line.includes("}}");

    // Highlight {{variables}} inline
    const renderLineContent = (lineText: string) => {
      const parts = lineText.split(/({{[^}]+}})/g);
      return parts.map((part, j) => {
        if (part.startsWith("{{") && part.endsWith("}}")) {
          return (
            <span
              key={j}
              className="bg-primary/10 text-primary font-mono text-xs px-1 rounded"
            >
              {part}
            </span>
          );
        }
        return <span key={j}>{part}</span>;
      });
    };

    if (line.trim() === "---" || line.trim() === "***") {
      return (
        <hr key={i} className="my-4 border-border/50" />
      );
    }

    return (
      <div
        key={i}
        className={cn(
          "leading-relaxed",
          isSectionHeader
            ? "mt-5 mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"
            : "text-sm text-foreground/90",
          !line.trim() && "h-3"
        )}
      >
        {line.trim() ? renderLineContent(line) : null}
      </div>
    );
  });
}

export function ResolvedView({ isOpen }: ResolvedViewProps) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setError(null);
    api
      .get<{ data: { prompt: string } }>("/agent/prompt-preview")
      .then((res) => {
        setPrompt(res.data.prompt);
      })
      .catch((err) => {
        console.error(err);
        setError("No se pudo cargar el prompt resuelto");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
        <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-semibold">Vista Resuelta</span>
        <span className="text-xs text-muted-foreground ml-auto">
          Solo lectura — variables reemplazadas con sus valores
        </span>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-5">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner />
            </div>
          )}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          )}
          {prompt && !isLoading && (
            <div className="font-mono text-sm space-y-0.5">
              {formatResolvedPrompt(prompt)}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
