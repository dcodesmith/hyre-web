import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { ForbiddenPage } from "~/components/errors/forbidden-page";
import { NotFoundPage } from "~/components/errors/not-found-page";
import { ServerErrorPage } from "~/components/errors/server-error-page";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/logo.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.svg" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap",
  },
];

interface LayoutProps {
  readonly children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <html lang="en" className="h-full" data-theme="tripdly">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-background">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <NotFoundPage />;
    }
    if (error.status === 403) {
      return <ForbiddenPage />;
    }

    return (
      <ServerErrorPage
        status={error.status}
        details={error.statusText}
        showDetails={import.meta.env.DEV}
      />
    );
  }

  return (
    <ServerErrorPage
      details={error instanceof Error ? error.message : undefined}
      showDetails={import.meta.env.DEV}
    />
  );
}
