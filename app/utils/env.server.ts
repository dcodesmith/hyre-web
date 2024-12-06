/* eslint-disable @typescript-eslint/no-namespace */
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["production", "development", "test"] as const),
  SESSION_SECRET: z.string().optional(),
  ENCRYPTION_SECRET: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  DEV_HOST_URL: z.string().optional(),
  PROD_HOST_URL: z.string().optional(),
  RESEND_API_KEY: z.string(),
  OPENAI_API_KEY: z.string().optional(),
  REDIS_URL: z
    .string()
    .transform((value) => {
      if (process.env.NODE_ENV === "development" && !value) {
        throw new Error("REDIS_URL is required in development");
      }
      return value;
    })
    .optional(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_REGION: z.string(),
  AWS_BUCKET_NAME: z.string(),
  APP_NAME: z.string(),
});

// declare global {
//   namespace NodeJS {
//     interface ProcessEnv extends z.infer<typeof schema> {}
//   }
// }

export function initEnvs() {
  console.log("Initializing environment variables...");
  const parsed = schema.safeParse(process.env);

  if (parsed.success === false) {
    console.error(
      "Invalid environment variables:",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Invalid environment variables.");
  }
}

/**
 * Exports shared environment variables.
 * Do *NOT* add any environment variables that do not wish to be included in the client.
 */
export function getSharedEnvs() {
  return {
    DEV_HOST_URL: process.env.DEV_HOST_URL,
    PROD_HOST_URL: process.env.PROD_HOST_URL,
    APP_NAME: process.env.APP_NAME,
  };
}

type ENV = ReturnType<typeof getSharedEnvs>;

declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof schema> {}
  }

  let ENV: ENV;
  interface Window {
    ENV: ENV;
  }
}
