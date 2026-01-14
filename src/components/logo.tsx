import Image from "next/image";
import Link from "next/link";

export const Logo = () => {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-card ring-1 ring-emerald-100">
        <Image
          src="/logo.svg"
          alt="Gesmeco Energía"
          width={32}
          height={32}
          priority
        />
      </div>
      <div className="leading-tight">
        <div className="text-sm uppercase tracking-[0.08em] text-emerald-700">
          Asesoría Gesmeco
        </div>
        <div className="text-lg font-semibold text-foreground">Gesmeco Energía</div>
      </div>
    </Link>
  );
};
