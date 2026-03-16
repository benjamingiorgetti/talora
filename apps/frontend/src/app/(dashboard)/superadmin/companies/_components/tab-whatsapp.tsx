"use client";

import Image from "next/image";
import type { WhatsAppInstance } from "@talora/shared";
import { Plus, RefreshCw, Trash2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toQrSrc } from "./types";

export function TabWhatsapp({
  instances,
  instanceQr,
  creatingInstance,
  onCreateInstance,
  onConnectInstance,
  onRefreshQr,
  onDeleteInstance,
}: {
  instances: WhatsAppInstance[] | undefined;
  instanceQr: Record<string, string | null>;
  creatingInstance: boolean;
  onCreateInstance: () => void;
  onConnectInstance: (instanceId: string) => void;
  onRefreshQr: (instanceId: string) => void;
  onDeleteInstance: (instanceId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">WhatsApp</h4>
          <p className="mt-1 text-sm text-slate-500">
            {(instances?.length ?? 0) > 0
              ? `${instances?.filter((i) => i.status === "connected").length ?? 0} de ${instances?.length ?? 0} instancia(s) conectadas`
              : "Crea una instancia y escanea el QR para conectar"}
          </p>
        </div>
        <Button disabled={creatingInstance} onClick={onCreateInstance} className="h-10 rounded-2xl bg-[#17352d] px-4 hover:bg-[#21453a]">
          <Plus className="mr-2 h-4 w-4" />
          {creatingInstance ? "Creando..." : "Crear instancia"}
        </Button>
      </div>

      {(instances ?? []).length === 0 && (
        <div className="rounded-[22px] border border-dashed border-[#e5d9c7] bg-[#fcfaf6] px-4 py-10 text-center">
          <Wifi className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-950">Sin instancia de WhatsApp</p>
          <p className="mt-1 text-sm text-slate-500">Crea una instancia para vincular el numero de WhatsApp de esta empresa.</p>
        </div>
      )}

      {(instances ?? []).map((instance) => {
        const qrSrc = toQrSrc(instanceQr[instance.id] ?? instance.qr_code);
        return (
          <div key={instance.id} className="rounded-[22px] border border-[#eadfce] bg-[#fcfaf6] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{instance.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {instance.status === "connected"
                    ? `Conectado${instance.phone_number ? ` · ${instance.phone_number}` : ""}`
                    : instance.status === "qr_pending"
                    ? "Esperando escaneo QR"
                    : "Desconectado"}
                </p>
              </div>
              <span className={instance.status === "connected" ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700" : "rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"}>
                {instance.status === "connected" ? "Conectado" : instance.status === "qr_pending" ? "QR" : "Pendiente"}
              </span>
            </div>

            {qrSrc && instance.status !== "connected" && (
              <div className="mt-4 rounded-[18px] border border-[#f0e7da] bg-white p-4">
                <Image
                  src={qrSrc}
                  alt={`QR ${instance.name}`}
                  width={200}
                  height={200}
                  unoptimized
                  className="mx-auto rounded-xl bg-white p-2"
                />
                <p className="mt-3 text-center text-sm text-slate-500">
                  Escanea este QR desde WhatsApp para vincular el numero.
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {instance.status !== "connected" && (
                <>
                  <Button variant="outline" onClick={() => onConnectInstance(instance.id)} className="h-9 rounded-2xl border-[#e5d9c8] bg-white px-4 hover:bg-[#f7efe4]">
                    <Wifi className="mr-2 h-4 w-4" />
                    Pedir QR
                  </Button>
                  <Button variant="outline" onClick={() => onRefreshQr(instance.id)} className="h-9 rounded-2xl border-[#e5d9c8] bg-white px-4 hover:bg-[#f7efe4]">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refrescar
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => onDeleteInstance(instance.id)} className="h-9 rounded-2xl border-[#edd6d3] bg-white px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
