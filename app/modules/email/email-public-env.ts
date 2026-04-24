/**
 * Reads a small subset of `process.env` for email rendering.
 * Email modules import this instead of `~/utils/server/env.server` so they can be
 * loaded by the React Email preview server without full app env validation.
 */
export function getEmailPublicEnv() {
  return {
    appName: process.env.APP_NAME ?? "Tripdly",
    domain: process.env.DOMAIN ?? "https://tripdly.com",
    websiteUrl: process.env.WEBSITE_URL ?? process.env.DOMAIN ?? "https://tripdly.com",
    supportEmail: process.env.SUPPORT_EMAIL ?? "support@tripdly.com",
  };
}
