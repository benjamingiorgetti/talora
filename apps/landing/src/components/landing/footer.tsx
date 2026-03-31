import Image from "next/image";
import { footer, nav } from "@/lib/content";
import { Button } from "@/components/ui/button";

export function Footer() {
  return (
    <footer className="border-t border-[#E8EAF1] bg-white">
      <div className="container mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr_0.8fr] md:items-start">
          <div className="max-w-sm">
            <Image
              src="/images/logo-talora.png"
              alt="Talora"
              width={164}
              height={48}
              className="h-12 w-auto"
            />
            <p className="mt-4 text-sm text-gray-medium leading-relaxed">
              {footer.tagline}
            </p>
            <p className="mt-2 text-xs text-gray-soft">
              {footer.microcopy}
            </p>
          </div>

          {footer.columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-text-strong">{col.title}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-gray-medium hover:text-ink transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex flex-col justify-start">
            <Button size="default" className="w-full sm:w-auto" asChild>
              <a href={nav.ctaHref} target="_blank" rel="noopener noreferrer">
                {nav.cta}
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-8 border-t border-[#E8EAF1] pt-6">
          <p className="text-xs text-gray-soft">&copy; {new Date().getFullYear()} Talora. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
