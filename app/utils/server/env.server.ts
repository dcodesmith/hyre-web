import { z } from "zod";
import { envSchema } from "~/schemas/env.schema";

const schema = envSchema;

let validatedEnv: z.infer<typeof schema>; // module-level cache

export function initEnvs() {
  if (typeof process === "undefined" || !process.env) {
    throw new Error("Environment variables are not available");
  }

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.issues);
    throw new Error("Invalid environment variables.");
  }

  // biome-ignore lint/suspicious/noConsoleLog: <explanation>
  console.log("Environment variables validated successfully");

  validatedEnv = parsed.data; // cache for later use
  return validatedEnv;
}

export const env = initEnvs();

/**
 * Exports shared environment variables.
 * Do *NOT* add any environment variables that do not wish to be included in the client.
 */
export function getSharedEnvs() {
  return {
    APP_NAME: env.APP_NAME,
    GOOGLE_MAPS_API_KEY: env.GOOGLE_MAPS_API_KEY,
    DOMAIN: env.DOMAIN,
    CLOUDFRONT_DOMAIN: env.CLOUDFRONT_DOMAIN,
  };
}

export type ENV = ReturnType<typeof getSharedEnvs>;

declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof schema> {}
  }

  let ENV: ENV;
  interface Window {
    ENV: ENV;
  }
}
