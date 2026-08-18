import { index, layout, type RouteConfig, route } from "@react-router/dev/routes";

const visualRoutes =
  process.env.VISUAL_TESTING === "true"
    ? [route("__visual/public-shell", "routes/__visual.public-shell.tsx")]
    : [];

export default [
  layout("routes/_public.tsx", [index("routes/home.tsx"), ...visualRoutes]),
] satisfies RouteConfig;
