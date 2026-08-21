const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_token",
  "__Secure-better-auth.session_data",
] as const;

export function appendSetCookies(target: Headers, source: Headers) {
  for (const cookie of source.getSetCookie()) {
    target.append("Set-Cookie", cookie);
  }

  return target;
}

export function expireSessionCookies(cookieHeader?: string | null) {
  const names = new Set<string>(SESSION_COOKIE_NAMES);

  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const separator = part.indexOf("=");

      if (separator === -1) {
        continue;
      }

      const name = part.slice(0, separator).trim();

      if (name.includes("session_token") || name.includes("session_data")) {
        names.add(name);
      }
    }
  }

  return [...names].map((name) => expireCookie(name));
}

function expireCookie(name: string) {
  const attributes = [`${name}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];

  if (name.startsWith("__Host-") || name.startsWith("__Secure-")) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function authResponseHeaders(source?: Headers) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
  });

  if (source) {
    appendSetCookies(headers, source);
  }

  return headers;
}
