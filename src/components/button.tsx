import Link from "next/link";
import { ButtonHTMLAttributes, CSSProperties, PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: string;
    variant?: "primary" | "ghost" | "accent";
    size?: "md" | "lg";
  }
>;

const getButtonStyles = (variant: string): CSSProperties => {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    borderRadius: "9999px",
    fontWeight: "900",
    fontSize: "13px",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    transition: "all 0.2s ease",
    border: "none",
    cursor: "pointer",
    boxSizing: "border-box",
  };

  if (variant === "ghost") {
    return {
      ...base,
      background: "linear-gradient(to bottom, #e5e7eb, #d1d5db)",
      color: "#0f0f1e",
      padding: "12px 24px",
      fontWeight: "900",
      border: "2px solid #9ca3af",
      boxShadow: "0 8px 0 rgba(107,114,128,0.4), 0 4px 0 rgba(0,0,0,0.15)",
    };
  }

  if (variant === "accent") {
    return {
      ...base,
      background: "linear-gradient(to bottom, #3b82f6, #1d4ed8)",
      color: "white",
      padding: "12px 24px",
      fontWeight: "900",
      border: "2px solid #1e40af",
      boxShadow: "0 8px 0 rgba(29,78,216,0.5), 0 4px 0 rgba(0,0,0,0.2)",
    };
  }

  // primary (red)
  return {
    ...base,
    background: "linear-gradient(to bottom, #ef4444, #991b1b)",
    color: "white",
    padding: "12px 24px",
    fontWeight: "900",
    border: "2px solid #7c2d12",
    boxShadow: "0 8px 0 rgba(159,18,57,0.5), 0 4px 0 rgba(0,0,0,0.2)",
  };
};

export const Button = ({
  children,
  className,
  href,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) => {
  const buttonStyle = getButtonStyles(variant);
  const base = "inline-flex items-center gap-2 rounded-full font-black transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-y-1";

  const sizes =
    size === "lg"
      ? "px-8 py-3.5 text-base"
      : "px-6 py-3 text-sm md:text-base";

  const classes = cn(base, sizes, className);

  if (href) {
    return (
      <Link href={href} className={classes} style={buttonStyle}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} style={buttonStyle} {...props}>
      {children}
    </button>
  );
};
