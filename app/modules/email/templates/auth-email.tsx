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
      <Heading className="text-xl font-medium text-gray-800">
        Your {intent === "registration" ? "registration" : "login"} code for {env.APP_NAME}
      </Heading>

      <Text className="text-sm text-gray-800">
        Use the {intent} verification code below. It is only valid for 60 seconds.
      </Text>
      <code className="text-xl font-semibold">{code}</code>
    </EmailTemplate>,
  );
}
