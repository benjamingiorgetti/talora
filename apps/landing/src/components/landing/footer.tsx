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
            {/* Social icons */}
            <div className="mt-4 flex items-center gap-4">
              <a href="#" className="p-1 text-gray-soft hover:text-ink transition-colors" aria-label="Twitter">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4l11.733 16h4.267l-11.733 -16z" /><path d="M4 20l6.768 -6.768m2.46 -2.46L20 4" />
                </svg>
              </a>
              <a href="#" className="p-1 text-gray-soft hover:text-ink transition-colors" aria-label="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r=".5" fill="currentColor" />
                </svg>
              </a>
              <a href="#" className="p-1 text-gray-soft hover:text-ink transition-colors" aria-label="LinkedIn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" />
                </svg>
              </a>
            </div>
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
