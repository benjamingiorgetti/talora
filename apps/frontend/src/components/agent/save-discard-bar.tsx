"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw } from "lucide-react";

interface SaveDiscardBarProps {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function SaveDiscardBar({
  isDirty,
  isSaving,
  onSave,
  onDiscard,
}: SaveDiscardBarProps) {
  return (
    <AnimatePresence>
      {isDirty && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur-sm">
            <span className="text-xs text-muted-foreground font-medium mr-1">
              Cambios sin guardar
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onDiscard}
              disabled={isSaving}
              className="h-8 text-xs"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Descartar
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
