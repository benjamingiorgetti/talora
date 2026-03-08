"use client";

import { useMemo } from "react";
import useSWR from "swr";
import type { PromptSection } from "@bottoo/shared";
import { fetcher } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";
import { ErrorCard } from "@/components/ui/error-card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

function highlightVariables(text: string) {
  const parts = text.split(/({{[^}]+}})/g);
  return parts.map((part, i) => {
    if (part.startsWith("{{") && part.endsWith("}}")) {
      return (
        <span
          key={i}
          className="inline-block rounded-full bg-orange-100 border border-orange-300 px-3 py-0.5 font-mono text-sm font-bold text-orange-600"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function HighlightedContent({ content }: { content: string }) {
  const highlighted = useMemo(() => highlightVariables(content), [content]);
  return <>{highlighted}</>;
}

export function PromptEditorTab() {
  const { data: sections, error, isLoading, mutate } = useSWR<PromptSection[]>("/agent/sections", fetcher);

  const activeSections = useMemo(
    () => sections?.filter((s) => s.is_active).sort((a, b) => a.order - b.order),
    [sections]
  );

  if (error) return <ErrorCard onRetry={() => mutate()} />;
  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Prompt Completo</h2>
        <p className="mt-1 text-lg text-muted-foreground font-semibold">
          Vista previa del prompt final con todas las secciones activas
        </p>
      </div>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <div className="p-8 space-y-8 bg-amber-50/30 rounded-2xl border-2 border-dashed border-amber-200/50">
              {!activeSections || activeSections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <FileText className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-lg font-bold text-muted-foreground">
                    No hay secciones activas
                  </p>
                </div>
              ) : (
                activeSections.map((section, idx) => (
                  <div key={section.id}>
                    {idx > 0 && (
                      <div className="border-t border-amber-200/50 mb-8" />
                    )}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Badge className="rounded-full bg-primary/10 text-primary font-bold px-4 py-1 text-sm border-0">
                          {section.title}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="rounded-full text-xs font-bold"
                        >
                          #{section.order}
                        </Badge>
                      </div>
                      <div className="whitespace-pre-wrap text-base leading-relaxed">
                        <HighlightedContent content={section.content} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
