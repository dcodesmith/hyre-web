export type EmailProvider = "resend" | "smtp" | "console";

type ResolveEmailProviderInput = {
  VERCEL?: string;
  EMAIL_PROVIDER?: EmailProvider;
  NODE_ENV: "development" | "production" | "test";
};

export function resolveEmailProvider(value: ResolveEmailProviderInput): EmailProvider {
  if (value.VERCEL === "1") {
    return "resend";
  }

  if (value.EMAIL_PROVIDER) {
    return value.EMAIL_PROVIDER;
  }

  return value.NODE_ENV === "production" ? "resend" : "smtp";
}
