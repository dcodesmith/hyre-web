import type { ReactNode } from "react";
import { Link } from "@remix-run/react";
import { BrandLogo } from "./BrandLogo";

interface AuthSplitLayoutProps {
  readonly children: ReactNode;
}

export function AuthSplitLayout({ children }: AuthSplitLayoutProps) {
  return (
    <div className="min-h-svh bg-white text-neutral-700">
      <div className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
        <div
          className="relative hidden overflow-hidden border-r border-neutral-200 bg-[#F7F5F1] p-12 lg:flex lg:flex-col lg:justify-between"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(184,146,42,0.2) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-[#B8922A]/5" />

          <Link to="/" className="relative z-10 flex w-fit items-center gap-3 no-underline">
            <BrandLogo />
          </Link>

          <div className="relative z-10">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-[#B8922A]">
              Chauffeur Service
            </p>
            <h1 className="font-display mb-5 text-5xl font-light leading-[1.18] text-[#1A1814]">
              Every journey,
              <br />
              <span className="text-[#D4A843] italic">expertly</span>
              <br />
              chauffeured.
            </h1>
            <p className="max-w-[300px] text-sm font-light leading-relaxed text-neutral-500">
              Professional drivers. Door-to-door comfort. Whether you&apos;re landing at Murtala
              Muhammed or heading to your next meeting - Tripdly handles the road.
            </p>
          </div>

        </div>

        <div className="flex flex-col items-center justify-center bg-white px-8 py-14 lg:px-16">
          <Link to="/" className="mb-10 flex items-center gap-3 self-start lg:hidden no-underline">
            <BrandLogo iconContainerClassName="h-9 w-9" />
          </Link>

          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
