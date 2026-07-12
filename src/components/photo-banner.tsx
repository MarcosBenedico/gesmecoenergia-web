import Image from "next/image";
import Link from "next/link";

type PhotoBannerProps = {
  src: string;
  alt: string;
  kicker?: string;
  title?: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
  /** Altura de la banda; por defecto media */
  size?: "sm" | "md" | "lg";
  priority?: boolean;
};

const HEIGHTS = {
  sm: "min-h-[220px] md:min-h-[260px]",
  md: "min-h-[300px] md:min-h-[380px]",
  lg: "min-h-[380px] md:min-h-[480px]",
};

export function PhotoBanner({
  src,
  alt,
  kicker,
  title,
  description,
  ctaHref,
  ctaLabel,
  size = "md",
  priority = false,
}: PhotoBannerProps) {
  return (
    <div
      className={`group relative flex ${HEIGHTS[size]} items-end overflow-hidden rounded-3xl border border-border/60 shadow-[0_20px_60px_rgba(0,0,0,0.4)]`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 1280px) 100vw, 1280px"
        className="object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-[1.04]"
      />
      {/* Overlays para legibilidad */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/40 to-transparent" />

      {/* Línea de acento superior */}
      <div className="absolute left-0 top-0 h-px w-48 bg-gradient-to-r from-accent/70 to-transparent" />
      <div className="absolute left-0 top-0 h-48 w-px bg-gradient-to-b from-accent/70 to-transparent" />

      {(kicker || title || description) && (
        <div className="relative w-full p-6 md:p-10">
          {kicker && (
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
              {kicker}
            </p>
          )}
          {title && (
            <h3 className="mt-2 max-w-2xl text-2xl font-black leading-tight text-foreground md:text-3xl">
              {title}
            </h3>
          )}
          {description && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted md:text-base">
              {description}
            </p>
          )}
          {ctaHref && ctaLabel && (
            <Link
              href={ctaHref}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-foreground/20 bg-background/60 px-5 py-3 text-sm font-bold text-foreground backdrop-blur-sm transition-all duration-300 hover:border-accent/60 hover:bg-accent/10 hover:text-accent"
            >
              {ctaLabel} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
