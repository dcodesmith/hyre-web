import { index, layout, type RouteConfig, route } from "@react-router/dev/routes";

const visualRoutes =
  process.env.VISUAL_TESTING === "true"
    ? [
        route("__visual/public-shell", "routes/__visual.public-shell.tsx"),
        route("__visual/home", "routes/__visual.home.tsx"),
        route("__visual/search", "routes/__visual.search.tsx"),
      ]
    : [];

export default [
  layout("routes/_public.tsx", [
    index("routes/home.tsx"),
    route("search", "routes/search.tsx"),
    route("about", "routes/about.tsx"),
    route("faq", "routes/faq.tsx"),
    route("terms", "routes/terms.tsx"),
    route("privacy", "routes/privacy.tsx"),
    route("cookies", "routes/cookies.tsx"),
    ...visualRoutes,
  ]),
] satisfies RouteConfig;
