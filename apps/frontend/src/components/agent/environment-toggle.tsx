"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EnvironmentToggleProps {
  mode: "production" | "test";
  onChange: (mode: "production" | "test") => void;
}

export function EnvironmentToggle({ mode, onChange }: EnvironmentToggleProps) {
  return (
    <div
      className="flex items-center rounded-md border border-border bg-muted/40 p-0.5"
      role="group"
      aria-label="Seleccionar modo de entorno"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange("production")}
        className={cn(
          "relative h-auto rounded px-3 py-1 text-xs font-medium transition-all duration-150",
          mode === "production"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={mode === "production"}
      >
        Produccion
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange("test")}
        className={cn(
          "relative h-auto rounded px-3 py-1 text-xs font-medium transition-all duration-150",
          mode === "test"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={mode === "test"}
      >
        Test
      </Button>
    </div>
  );
}
