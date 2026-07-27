import { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

type FeatureCardProps = PropsWithChildren<{
  title: string;
  description?: string;
  badge?: string;
  className?: string;
}>;

export const FeatureCard = ({
  title,
  description,
  badge,
  children,
  className,
}: FeatureCardProps) => {
  return (
    // `foco` enciende el brillo que sigue al ratón (ver globals.css). Lo lleva
    // la tarjeta y no cada página, que es la que se usa en servicios, sectores
    // y sobre-nosotros.
    <div className={cn("card foco flex flex-col gap-3 rounded-2xl p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {badge && (
            <span className="pill mb-2 inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
              {badge}
            </span>
          )}
          <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        </div>
      </div>
      {description && <p className="text-sm text-muted">{description}</p>}
      {children}
    </div>
  );
};
