"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorCard({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <p className="text-lg font-bold text-muted-foreground mb-1">
        {message ?? "Error al cargar los datos"}
      </p>
      <Button onClick={onRetry} variant="outline" className="mt-4 h-12 rounded-xl border-2 text-base font-bold">
        Reintentar
      </Button>
    </div>
  );
}
