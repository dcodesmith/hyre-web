import { env } from "cloudflare:workers";
import { data } from "react-router";

import { ApiRequestError } from "~/lib/api/api.server";
import { getCarCategories } from "~/lib/api/cars.server";
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

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const response = await getCarCategories({ request });

    return {
      runtimeMessage: env.VALUE_FROM_CLOUDFLARE,
      apiStatus: {
        status: response.status,
        totalCars: response.data.total,
        categoryCount: response.data.categories.length,
      },
    };
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw data(error.problem, {
        status: error.status,
        statusText: error.problem.title,
      });
    }

    throw error;
  }
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
        The Cloudflare Workers SSR foundation is connected to the Nest API.
      </p>
      <p className="text-sm text-slate-500">{loaderData.runtimeMessage}</p>
      <p className="text-sm text-slate-500">
        API {loaderData.apiStatus.status}: validated{" "}
        {loaderData.apiStatus.totalCars} cars across{" "}
        {loaderData.apiStatus.categoryCount} categories.
      </p>
    </main>
  );
}
