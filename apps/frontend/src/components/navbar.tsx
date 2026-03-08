"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { WsConnectionStatus } from "@/components/ws-connection-status";
import { cn } from "@/lib/utils";
import { LogOut, MessageSquare, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { spring } from "@/lib/motion";

const navItems = [
  { href: "/", label: "Instancias", icon: MessageSquare },
  { href: "/agent", label: "Agente", icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();
  const { logout, token } = useAuth();

  if (!token) return null;

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b border-border">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <div className="mr-10 flex items-center">
          <Link href="/" aria-label="Talora home" className="flex items-center gap-2.5">
            <Image src="/talora-logo-transparent.png" alt="Talora" width={28} height={28} className="rounded-md" />
            <span className="text-foreground font-semibold text-base tracking-tight">
              Talora
            </span>
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1" aria-label="Navegacion principal">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 rounded-md py-1.5 px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-md bg-accent"
                    transition={spring.indicator}
                    style={{ zIndex: -1 }}
                  />
                )}
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side: WS status + logout */}
        <div className="ml-auto flex items-center gap-3">
          <WsConnectionStatus />
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="gap-2 text-sm text-muted-foreground hover:text-destructive hover:bg-transparent"
            aria-label="Cerrar sesion"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Salir
          </Button>
        </div>
      </div>
    </header>
  );
}
