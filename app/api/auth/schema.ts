import { z } from "zod";

export const AUTH_ROLES = ["user", "fleetOwner", "admin", "staff"] as const;

export const authRoleSchema = z.enum(AUTH_ROLES);

export const sendOtpResponseSchema = z.object({
  success: z.boolean(),
});

export const signInResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.email(),
    roles: z.array(z.string()).optional(),
  }),
  token: z.string().optional(),
});

export const sessionResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.email(),
    name: z.string().nullable().optional(),
    roles: z.array(z.string()),
  }),
  session: z.unknown(),
});

export const signOutResponseSchema = z.unknown();

export type AuthRole = z.infer<typeof authRoleSchema>;
export type AuthSession = z.infer<typeof sessionResponseSchema>;
