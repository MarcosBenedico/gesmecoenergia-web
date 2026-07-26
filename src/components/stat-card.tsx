import { cn } from "@/lib/utils";

type StatCardProps = {
  value: string;
  label: string;
  detail?: string;
  className?: string;
};

export const StatCard = ({ value, label, detail, className }: StatCardProps) => {
  return (
    <div
      className={cn(
        "card flex flex-col gap-2 rounded-2xl p-5 text-left shadow-card",
        className
      )}
    >
      {/* Era `text-rose-700` (#be123c) sobre la tarjeta oscura: 2,4:1 de
          contraste, cuando el mínimo legible para texto pequeño es 4,5:1. El
          rótulo de cada cifra estaba prácticamente ilegible. El rojo claro de
          la marca da 5,5:1 y además es el color de la casa. */}
      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-accent-light">
        {label}
      </div>
      <div className="cifra text-4xl font-semibold text-foreground">{value}</div>
      {detail && <div className="text-sm text-muted">{detail}</div>}
    </div>
  );
};
