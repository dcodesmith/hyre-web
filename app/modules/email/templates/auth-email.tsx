import { Button, Heading, Section, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { env } from "~/utils/server/env.server";
import { EmailTemplate } from "./EmailTemplate";

type AuthEmailOptions = {
  code: string;
  magicLink?: string | null;
  intent: "registration" | "login";
};

export function renderAuthEmail({ code, magicLink, intent }: AuthEmailOptions) {
  return render(
    <EmailTemplate previewText={`Your ${env.APP_NAME} ${intent} code`}>
      <Heading className="text-2xl font-medium text-gray-800">
        Your {intent === "registration" ? "registration" : "login"} code for {env.APP_NAME}
      </Heading>
      {magicLink && (
        <Section className="py-4">
          <Button className="bg-slate-800 text-white font-semibold text-sm p-4" href={magicLink}>
            {intent === "registration"
              ? `Complete your ${env.APP_NAME} registration`
              : `Login to ${env.APP_NAME}`}
          </Button>
        </Section>
      )}
      <Text className="text-sm text-gray-800">
        This link and code will only be valid for the next 60 seconds. If the link does not work,
        you can use the {intent} verification code directly:
      </Text>
      <code className="text-xl font-semibold">{code}</code>
    </EmailTemplate>,
  );
}
