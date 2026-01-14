import { cn } from "@/lib/utils";
import { PropsWithChildren } from "react";

type SectionHeadingProps = PropsWithChildren<{
  title: string;
  kicker?: string;
  align?: "left" | "center";
  className?: string;
}>;

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
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className
      )}
    >
      {kicker && (
        <span className="pill inline-flex w-fit items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          <span className="h-2 w-2 rounded-full bg-accent" />
          {kicker}
        </span>
      )}
      <h2 className="text-3xl font-semibold text-foreground md:text-4xl">{title}</h2>
      {children && <p className="max-w-3xl text-lg text-muted">{children}</p>}
    </div>
  );
};
