import { cn } from "@/lib/utils";

interface SectionWrapperProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}

export function SectionWrapper({ children, className, id, style }: SectionWrapperProps) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-24 py-12 sm:scroll-mt-28 sm:py-20 md:py-28", className)}
      style={style}
    >
      <div className="container mx-auto max-w-[1200px] px-4 sm:px-6">{children}</div>
    </section>
  );
}
