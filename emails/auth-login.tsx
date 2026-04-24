import type { AuthEmailOptions } from "../app/modules/email/templates/auth-email";
import { AuthEmail } from "../app/modules/email/templates/auth-email";

export default function AuthLoginPreview(props: AuthEmailOptions) {
  return <AuthEmail {...props} />;
}

AuthLoginPreview.PreviewProps = {
  code: "739105",
  intent: "login" as const,
};
