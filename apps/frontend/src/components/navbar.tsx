"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { WsConnectionStatus } from "@/components/ws-connection-status";
import { cn } from "@/lib/utils";
import { LogOut, MessageSquare, Settings, Sparkles } from "lucide-react";

const navItems = [
  { href: "/", label: "Instancias", icon: MessageSquare },
  { href: "/agent", label: "Agente", icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();
  const { logout, token } = useAuth();

  if (!token) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-background/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center">
        <div className="mr-10 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="text-xl font-extrabold text-primary tracking-tight">
            Illuminato
          </span>
        </div>
        <nav className="flex items-center gap-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl py-3 px-5 text-base font-bold transition-all duration-200",
                  isActive
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <WsConnectionStatus />
          <Button
            variant="outline"
            onClick={logout}
            className="rounded-xl border-2 border-red-300 bg-red-50 text-red-600 font-bold hover:bg-red-100 hover:text-red-700 px-5 py-2.5 h-auto"
            aria-label="Cerrar sesion"
          >
            <LogOut className="mr-2 h-5 w-5" aria-hidden="true" />
            Salir
          </Button>
        </div>
      </div>
    </header>
  );
}
