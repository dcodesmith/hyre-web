const SESSION_COOKIE_NAMES = [
  "session_token",
  "session_data",
  "__Host-session_token",
  "__Host-session_data",
] as const;

export function appendSetCookies(target: Headers, source: Headers) {
  for (const cookie of source.getSetCookie()) {
    target.append("Set-Cookie", cookie);
  }

  return target;
}

export function expireSessionCookies() {
  return SESSION_COOKIE_NAMES.map((name) => {
    const attributes = [`${name}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];

    if (name.startsWith("__Host-")) {
      attributes.push("Secure");
    }

    return attributes.join("; ");
  });
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
