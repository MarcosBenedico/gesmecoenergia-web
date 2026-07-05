import { ReactNode } from "react";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { Background3D } from "@/components/background-3d";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground">
      <Background3D />
      <div className="relative z-10">
        <Navbar />
        <main>{children}</main>
        <Footer />
        <WhatsAppButton />
      </div>
    </div>
  );
}
