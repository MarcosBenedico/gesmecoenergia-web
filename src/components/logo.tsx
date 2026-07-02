import Image from "next/image";
import Link from "next/link";

export const Logo = () => {
  return (
    <Link href="/" className="flex items-center" aria-label="Gesmeco Energía · Inicio">
      <div className="rounded-2xl bg-white px-4 py-2 shadow-card ring-1 ring-rose-100 transition hover:shadow-lg">
        <Image
          src="/logo-gesmeco.png"
          alt="Gesmeco Energía"
          width={779}
          height={269}
          priority
          className="h-11 w-auto md:h-14"
        />
      </div>
    </Link>
  );
};
