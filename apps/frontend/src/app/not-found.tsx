import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-emerald-950 shadow-[0_18px_36px_rgba(6,78,59,0.2)]">
          <Image
            src="/talora-logo-transparent.png"
            alt="Talora"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
          />
        </div>

        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
            Error 404
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Pagina no encontrada
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
            La ruta que buscas no existe o fue movida. Verifica la URL o volve al inicio.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center rounded-2xl bg-emerald-950 px-5 text-sm font-semibold text-white hover:bg-emerald-900"
        >
          Ir al dashboard
        </Link>
      </div>
    </div>
  );
}
