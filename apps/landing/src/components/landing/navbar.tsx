"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import brandLogo from "../../../../../img/logo.png";
import { Button } from "@/components/ui/button";
import { nav } from "@/lib/content";
import { cn } from "@/lib/utils";

const sectionIds = ["que-cambia", "como-funciona", "faq"];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      setScrolled(currentY > 40);
      if (currentY > 80) {
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
    <>
      {/* Document-flow spacer so content below doesn't jump under the fixed header */}
      <div className="h-14" aria-hidden="true" />

      {/* Fixed wrapper — no bg/border here; those live on the inner pill */}
      <header
        className={cn(
          "fixed top-0 inset-x-0 z-50 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          hidden ? "-translate-y-[150%]" : "translate-y-0"
        )}
      >
        {/*
          Inner container morphs between two states:
            - at-top:   full-width, transparent, no border, h-16
            - scrolled: centered pill, frosted glass, rounded-full, h-12, mt-3
        */}
        <div
          className={cn(
            "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            scrolled
              ? // Pill state — no backdrop-blur on mobile (causes flicker on iOS Safari)
                "mx-auto max-w-[620px] mt-3 rounded-full h-11 px-6 bg-white/95 md:backdrop-blur-xl md:bg-white/85 shadow-lg border border-white/60"
              : // Full-width transparent state
                "mx-auto max-w-[1200px] h-14 px-4 sm:px-6"
          )}
          style={
            scrolled
              ? { boxShadow: "0 4px 20px 0 rgba(28,29,34,0.08), 0 1px 3px 0 rgba(28,29,34,0.05)" }
              : undefined
          }
        >
          <div className="flex h-full items-center justify-between">
            {/* Logo */}
            <a href="/" className="flex items-center shrink-0">
              <Image
                src={brandLogo}
                alt="Talora"
                width={118}
                height={36}
                className={cn(
                  "h-auto w-[108px] transition-all duration-300",
                  scrolled ? "w-[92px]" : ""
                )}
              />
            </a>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6">
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
                    {/* Active underline */}
                    <span
                      className={cn(
                        "absolute bottom-0 left-1/2 h-[2px] bg-ink rounded-full transition-all duration-300 -translate-x-1/2",
                        isActive ? "w-full" : "w-0"
                      )}
                    />
                  </a>
                );
              })}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden md:block shrink-0">
              <Button
                size="sm"
                className={cn(
                  "animate-subtle-pulse transition-all duration-300",
                  scrolled && "h-8 text-xs px-4"
                )}
                asChild
              >
                <a href={nav.ctaHref} target="_blank" rel="noopener noreferrer">{nav.cta}</a>
              </Button>
            </div>

            {/* Mobile toggle */}
            <button
              className="md:hidden p-1.5 text-ink"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Cerrar menu" : "Abrir menu"}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown — appears below the pill/bar with matching rounded styling */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className={cn(
                "md:hidden overflow-hidden mt-2",
                scrolled
                  ? "mx-auto max-w-[620px] rounded-2xl bg-white border border-white/60"
                  : "mx-4 rounded-2xl bg-white border border-[#E2E4EC]/60 shadow-lg"
              )}
              style={{
                boxShadow: "0 8px 32px 0 rgba(28,29,34,0.10)",
              }}
            >
              <nav className="flex flex-col gap-1 px-4 py-3">
                {nav.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-xl px-3 py-3 text-sm text-gray-medium",
                      "hover:bg-surface-cool hover:text-ink transition-colors"
                    )}
                  >
                    {link.label}
                  </a>
                ))}
                <div className="pt-2 pb-1">
                  <Button className="w-full" size="default" asChild>
                    <a href={nav.ctaHref} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                      {nav.cta}
                    </a>
                  </Button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
