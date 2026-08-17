import { env } from "cloudflare:workers";

import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Hyre Web" },
    {
      name: "description",
      content: "Hyre's chauffeur-driven vehicle booking experience.",
    },
  ];
}

export function loader() {
  return { runtimeMessage: env.VALUE_FROM_CLOUDFLARE };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-6">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
        React Router v8 foundation
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
        Hyre Web
      </h1>
      <p className="max-w-xl text-lg text-slate-600">
        The Cloudflare Workers SSR foundation is ready for parity migration.
      </p>
      <p className="text-sm text-slate-500">{loaderData.runtimeMessage}</p>
    </main>
  );
}
