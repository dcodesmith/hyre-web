import { index, layout, type RouteConfig, route } from "@react-router/dev/routes";

const visualRoutes =
  process.env.VISUAL_TESTING === "true"
    ? [
        route("__visual/public-shell", "routes/__visual.public-shell.tsx"),
        route("__visual/home", "routes/__visual.home.tsx"),
        route("__visual/search", "routes/__visual.search.tsx"),
        route("__visual/car", "routes/__visual.car.tsx"),
      ]
    : [];

export default [
  route("api/places/autocomplete", "routes/api.places.autocomplete.ts"),
  route("api/places/resolve", "routes/api.places.resolve.ts"),
  route("api/search-flight", "routes/api.search-flight.ts"),
  route("api/calculate-trip-duration", "routes/api.calculate-trip-duration.ts"),
  route("api/ai-search", "routes/api.ai-search.ts"),
  route("robots.txt", "routes/robots.txt.ts"),
  route("sitemap.xml", "routes/sitemap.xml.ts"),
  layout("routes/_public.tsx", [
    index("routes/home.tsx"),
    route("search", "routes/search.tsx"),
    route("cars/:carSlug", "routes/cars.$carSlug.tsx"),
    route("about", "routes/about.tsx"),
    route("faq", "routes/faq.tsx"),
    route("terms", "routes/terms.tsx"),
    route("privacy", "routes/privacy.tsx"),
    route("cookies", "routes/cookies.tsx"),
    route("logout", "routes/logout.ts"),
    ...visualRoutes,
  ]),
  layout("routes/_auth.tsx", [
    route("auth", "routes/auth.tsx"),
    route("verify", "routes/verify.tsx"),
  ]),
] satisfies RouteConfig;
