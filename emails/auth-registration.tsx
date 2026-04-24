import type { AuthEmailOptions } from "../app/modules/email/templates/auth-email";
import { AuthEmail } from "../app/modules/email/templates/auth-email";

export default function AuthRegistrationPreview(props: AuthEmailOptions) {
  return <AuthEmail {...props} />;
}

AuthRegistrationPreview.PreviewProps = {
  code: "482916",
  intent: "registration" as const,
};
