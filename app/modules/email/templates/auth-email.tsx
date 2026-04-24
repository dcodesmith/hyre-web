import { Heading, Text, render } from "react-email";
import { getEmailPublicEnv } from "../email-public-env";
import { EmailTemplate } from "./EmailTemplate";

export type AuthEmailOptions = {
  readonly code: string;
  readonly intent: "registration" | "login";
};

export function AuthEmail({ code, intent }: AuthEmailOptions) {
  const { appName } = getEmailPublicEnv();
  return (
    <EmailTemplate previewText={`Your ${appName} ${intent} code`}>
      <Heading className="text-xl font-medium text-gray-800">
        Your {intent} code for {appName}
      </Heading>

      <Text className="text-sm text-gray-800">
        Use the {intent} verification code below. It is only valid for 10 minutes.
      </Text>
      <code className="text-xl font-semibold">{code}</code>
    </EmailTemplate>
  );
}

export function renderAuthEmail({ code, intent }: AuthEmailOptions) {
  return render(<AuthEmail code={code} intent={intent} />);
}
