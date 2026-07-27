import { cn } from "@/lib/utils";
import { PropsWithChildren } from "react";

type SectionHeadingProps = PropsWithChildren<{
  title: string;
  kicker?: string;
  align?: "left" | "center";
  className?: string;
}>;

/**
 * Cabecera de sección del escaparate.
 *
 * El `h2` no lleva clases de tamaño ni de peso a propósito: en la web pública
 * eso lo decide `.web-publica h2` en `globals.css`, que va sin capa y gana a
 * cualquier utilidad. Antes tenía `text-3xl md:text-4xl font-semibold` y
 * ninguna de las tres pintaba nada; mejor no dejar clases que engañan a quien
 * las lea luego.
 */
export const SectionHeading = ({
  title,
  kicker,
  children,
  align = "left",
  className,
}: SectionHeadingProps) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className
      )}
    >
      {kicker && (
        <div className={cn("flex w-full items-center gap-4", align === "center" && "justify-center")}>
          <span className="pill inline-flex w-fit shrink-0 items-center gap-2.5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
            {/* El punto late: es la señal de que la página está viva, y se
                repite en todas las secciones para que se lea como un sistema. */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-50" />
              <span className="relative h-2 w-2 rounded-full bg-accent" />
            </span>
            {kicker}
          </span>
          {/* Filete que lleva la vista del rótulo hacia el titular. */}
          {align !== "center" && (
            <span className="h-px min-w-0 flex-1 bg-gradient-to-r from-border via-border/40 to-transparent" aria-hidden />
          )}
        </div>
      )}
      <h2 className="max-w-4xl text-foreground">{title}</h2>
      {children && <p className="max-w-3xl text-lg text-muted">{children}</p>}
    </div>
  );
};
