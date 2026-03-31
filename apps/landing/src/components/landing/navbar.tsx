"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nav } from "@/lib/content";
import { cn } from "@/lib/utils";

const sectionIds = ["que-cambia", "como-funciona", "faq"];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 36);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        { rootMargin: "-42% 0px -48% 0px" }
      );

      observer.observe(element);
      observers.push(observer);
    });

    return () => observers.forEach((observer) => observer.disconnect());
  }, []);

  return (
    <>
      <div className="h-16 sm:h-[72px]" aria-hidden="true" />

      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto max-w-[1200px] px-4 pt-3 sm:px-6 sm:pt-4">
          <div
            className={cn(
              "flex items-center justify-between rounded-full px-4 transition-all duration-300 sm:px-6",
              scrolled
                ? "border border-white/80 bg-white/82 py-2 shadow-[0_12px_32px_rgba(17,19,24,0.06)] backdrop-blur-md"
                : "bg-transparent py-3"
            )}
          >
            <a href="/" className="flex items-center">
              <Image
                src="/images/logo-talora.png"
                alt="Talora"
                width={150}
                height={44}
                className="h-10 w-auto sm:h-11"
                priority
              />
            </a>

            <nav className="hidden items-center gap-7 md:flex">
              {nav.links.map((link) => {
                const isActive = activeSection === link.href.replace("#", "");

                return (
                  <a
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "text-sm transition-colors",
                      isActive ? "text-text-strong" : "text-gray-medium hover:text-text-strong"
                    )}
                  >
                    {link.label}
                  </a>
                );
              })}
            </nav>

            <div className="hidden md:block">
              <Button size="sm" className="shadow-none" asChild>
                <a href={nav.ctaHref} target="_blank" rel="noopener noreferrer">
                  {nav.cta}
                </a>
              </Button>
            </div>

            <button
              className="rounded-full border border-[#E5E8EF] bg-white/90 p-2 text-text-strong md:hidden"
              onClick={() => setOpen((prev) => !prev)}
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mx-4 mt-2 rounded-[28px] border border-white/80 bg-white/95 p-4 shadow-[0_16px_40px_rgba(17,19,24,0.08)] backdrop-blur-md sm:mx-6 md:hidden"
            >
              <nav className="flex flex-col gap-2">
                {nav.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-2xl px-4 py-3 text-sm text-gray-medium transition-colors hover:bg-[#F5F6FA] hover:text-text-strong"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="pt-2">
                  <Button className="w-full" asChild>
                    <a
                      href={nav.ctaHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setOpen(false)}
                    >
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
