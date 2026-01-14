import Link from "next/link";
import { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: string;
    variant?: "primary" | "ghost";
    size?: "md" | "lg";
  }
>;

export const Button = ({
  children,
  className,
  href,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) => {
  const base =
    "inline-flex items-center gap-2 rounded-full font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const sizes =
    size === "lg"
      ? "px-6 py-3 text-base"
      : "px-4 py-2.5 text-sm md:text-base";
  const variants =
    variant === "ghost"
      ? "border border-emerald-100 bg-white/80 text-foreground hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white shadow-sm"
      : "bg-accent text-white hover:-translate-y-0.5 hover:bg-accent-strong shadow-soft";

  const styles = cn(base, sizes, variants, className);

  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }

  return (
    <button className={styles} {...props}>
      {children}
    </button>
  );
};
