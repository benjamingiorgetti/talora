"use client";

import { useState, useEffect } from "react";
import { Send, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SlotFillSendModalProps {
  opportunityId: string | null;
  candidateId: string | null;
  clientName: string;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

export function SlotFillSendModal({
  opportunityId,
  candidateId,
  clientName,
  open,
  onClose,
  onSent,
}: SlotFillSendModalProps) {
  const defaultMessage = `Hola ${clientName}! Tenemos disponibilidad esta semana. Queres agendar tu turno? Responde y te busco horario.`;

  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);

  // Reset message when modal opens with a new client
  useEffect(() => {
    if (open && clientName) {
      setMessage(
        `Hola ${clientName}! Tenemos disponibilidad esta semana. Queres agendar tu turno? Responde y te busco horario.`
      );
    }
  }, [open, clientName]);

  const handleSend = async () => {
    if (!opportunityId || !candidateId) return;
    setSending(true);
    try {
      await api.post(`/growth/slot-fill/opportunities/${opportunityId}/send`, {
        candidateId,
        messageText: message,
      });
      toast.success(`Mensaje enviado a ${clientName}`);
      onSent();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="rounded-[28px] sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Enviar mensaje de slot</DialogTitle>
          <DialogDescription>
            Enviando mensaje a {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="slot-fill-message">Mensaje</Label>
            <Textarea
              id="slot-fill-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="min-h-[120px] rounded-2xl border-[#dde1ea] shadow-none"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-11 flex-1 rounded-2xl border-[#dde1ea] hover:bg-[#f6f7fb]"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSend()}
            disabled={sending || !message.trim()}
            className="h-11 flex-1 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
          >
            {sending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
