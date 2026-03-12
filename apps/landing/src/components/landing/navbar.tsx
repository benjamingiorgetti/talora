"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nav } from "@/lib/content";
import { cn } from "@/lib/utils";

const sectionIds = ["beneficios", "como-funciona", "faq"];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      setScrolled(currentY > 16);
      if (currentY > 60) {
        setHidden(currentY > lastScrollY.current);
      } else {
        setHidden(false);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Active section detection via IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id);
        },
        { rootMargin: "-40% 0px -55% 0px" }
      );
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b backdrop-blur-md transition-all duration-300",
        hidden ? "-translate-y-full" : "translate-y-0",
        scrolled
          ? "border-[#E2E4EC] bg-white/90 shadow-sm"
          : "border-transparent bg-white/60"
      )}
    >
      <div
        className={cn(
          "container mx-auto flex max-w-[1200px] items-center justify-between px-4 sm:px-6 transition-all duration-300",
          scrolled ? "h-14" : "h-16"
        )}
      >
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          {/* Icon only on mobile, full logo on sm+ */}
          <img
            src="/images/icono-negro.png"
            alt="Talora"
            width={28}
            height={28}
            className="block sm:hidden"
          />
          <img
            src="/images/logo-talora.png"
            alt="Talora"
            height={32}
            className="hidden sm:block h-8 w-auto"
          />
          <span className="hidden sm:inline text-xs text-gray-medium font-medium">{nav.descriptor}</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {nav.links.map((link) => {
            const isActive = activeSection === link.href.replace("#", "");
            return (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  "relative text-sm transition-colors py-1",
                  isActive ? "text-ink" : "text-gray-medium hover:text-ink"
                )}
              >
                {link.label}
                {/* Underline from center */}
                <span
                  className={cn(
                    "absolute bottom-0 left-1/2 h-[2px] bg-ink rounded-full transition-all duration-300 -translate-x-1/2",
                    isActive ? "w-full" : "w-0 group-hover:w-full"
                  )}
                />
                {/* Hover underline for non-active */}
                {!isActive && (
                  <span className="absolute bottom-0 left-1/2 h-[2px] bg-ink/40 rounded-full transition-all duration-300 -translate-x-1/2 w-0 hover-underline" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:block">
          <Button size="sm" className="animate-subtle-pulse" asChild>
            <a href={nav.ctaHref}>{nav.cta}</a>
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-ink"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Cerrar menu" : "Abrir menu"}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden border-t border-[#E2E4EC]/60 bg-white"
          >
            <nav className="flex flex-col gap-1 px-4 py-3 sm:px-6 sm:py-4">
              {nav.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-3 text-sm text-gray-medium",
                    "hover:bg-surface-cool hover:text-ink transition-colors"
                  )}
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-2">
                <Button className="w-full" size="default" asChild>
                  <a href={nav.ctaHref}>{nav.cta}</a>
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
