import { env } from "cloudflare:workers";
import { data } from "react-router";

import { ApiRequestError } from "~/lib/api/api.server";
import { getCarCategories } from "~/lib/api/cars.server";
import { toPublicProblemDetails } from "~/lib/api/problem-details";
import type { Route } from "./+types/home";

export function meta() {
  return [
    { title: "Tripdly | Chauffeur-driven vehicle booking" },
    {
      name: "description",
      content: "Book vetted chauffeurs and premium vehicles with Tripdly.",
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
      throw data(toPublicProblemDetails(error.problem), {
        status: error.status,
        statusText: error.problem.title,
      });
    }

    throw error;
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <div className="mx-auto flex min-h-[500px] max-w-3xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
        React Router v8 foundation
      </p>
      <h1 className="font-brand text-5xl font-bold tracking-tight text-slate-950">Tripdly</h1>
      <p className="max-w-xl text-lg text-slate-600">
        The Cloudflare Workers SSR foundation is connected to the Nest API.
      </p>
      <p className="text-sm text-slate-500">{loaderData.runtimeMessage}</p>
      <p className="text-sm text-slate-500">
        API {loaderData.apiStatus.status}: validated {loaderData.apiStatus.totalCars} cars across{" "}
        {loaderData.apiStatus.categoryCount} categories.
      </p>
    </div>
  );
}
