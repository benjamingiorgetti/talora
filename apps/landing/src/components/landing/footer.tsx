import { footer } from "@/lib/content";

export function Footer() {
  return (
    <footer className="border-t border-[#E2E4EC] bg-white">
      <div className="container mx-auto max-w-[1200px] px-4 sm:px-6 py-10 sm:py-12 md:py-16">
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-8 md:grid-cols-4 md:gap-10">
          {/* Brand */}
          <div>
            <img
              src="/images/logo-talora.png"
              alt="Talora"
              height={24}
              className="h-6 w-auto"
            />
            <p className="mt-2 text-sm text-gray-medium leading-relaxed">
              Automatiza turnos con WhatsApp e inteligencia artificial.
            </p>
            {/* Contact */}
            <a
              href="mailto:benjamin@talora.vip"
              className="mt-4 inline-block text-sm text-gray-medium hover:text-ink transition-colors"
            >
              benjamin@talora.vip
            </a>
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
