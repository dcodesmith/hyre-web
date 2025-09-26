import { Heading, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { env } from "~/utils/server/env.server";
import { EmailTemplate } from "./EmailTemplate";

type AuthEmailOptions = {
  code: string;
  intent: "registration" | "login";
};

export function renderAuthEmail({ code, intent }: AuthEmailOptions) {
  return render(
    <EmailTemplate previewText={`Your ${env.APP_NAME} ${intent} code`}>
      <Heading className="text-2xl font-medium text-gray-800">
        Your {intent === "registration" ? "registration" : "login"} code for {env.APP_NAME}
      </Heading>

      <Text className="text-sm text-gray-800">
        This code will only be valid for the next 60 seconds. Use the {intent} verification code
        below:
      </Text>
      <code className="text-xl font-semibold">{code}</code>
    </EmailTemplate>,
  );
}
