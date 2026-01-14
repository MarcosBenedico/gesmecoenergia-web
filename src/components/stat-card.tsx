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
      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
        {label}
      </div>
      <div className="text-4xl font-semibold text-foreground">{value}</div>
      {detail && <div className="text-sm text-muted">{detail}</div>}
    </div>
  );
};
