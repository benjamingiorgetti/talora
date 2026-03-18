import { footer, nav } from "@/lib/content";
import { Button } from "@/components/ui/button";

export function Footer() {
  return (
    <footer className="border-t border-[#E2E4EC] bg-white">
      <div className="container mx-auto max-w-[1200px] px-4 sm:px-6 py-12 sm:py-16 md:py-20">
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-8 md:grid-cols-4 md:gap-10">
          {/* Brand */}
          <div>
            <img
              src="/images/logo-talora.png"
              alt="Talora"
              height={56}
              className="h-14 w-auto"
            />
            <p className="mt-4 text-sm text-gray-medium leading-relaxed">
              {footer.tagline}
            </p>
            <p className="mt-2 text-xs text-gray-soft">
              {footer.microcopy}
            </p>
          </div>

          {/* Columns */}
          {footer.columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-text-strong">
                {col.title}
              </p>
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

          {/* CTA */}
          <div className="flex flex-col justify-start">
            <Button size="default" asChild>
              <a href={nav.ctaHref} target="_blank" rel="noopener noreferrer">
                {nav.cta}
              </a>
            </Button>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 sm:mt-10 md:mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#E2E4EC] pt-6 sm:pt-8 md:flex-row">
          <p className="text-xs text-gray-soft">
            &copy; {new Date().getFullYear()} Talora. Todos los derechos
            reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
