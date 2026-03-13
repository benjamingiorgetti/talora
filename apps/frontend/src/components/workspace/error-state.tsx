"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WorkspaceErrorState({
  message,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center rounded-[24px] border border-dashed border-[#e2c5c5] bg-[linear-gradient(180deg,#fff8f8_0%,#fdf2f2_100%)] px-5 py-10 text-center sm:rounded-[28px] sm:px-6 sm:py-12",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-[#e7c7d2] bg-white/90 text-[#714a58]">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="mt-4 font-medium text-slate-900">No se pudo cargar esta seccion</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {message || "Hubo un problema al conectar con el servidor. Verifica tu conexion e intenta de nuevo."}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          className="mt-5 h-10 rounded-2xl border-[#dde1ea] bg-white px-4 hover:bg-[#f6f7fb]"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
      )}
    </div>
  );
}
