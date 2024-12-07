import {
  Body,
  Button,
  Container,
  Heading,
  Hr,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import { EmailTemplate } from "./EmailTemplate";

type AuthEmailOptions = {
  email: string;
  code: string;
  magicLink?: string | null;
};

export function renderAuthEmail({ code, magicLink }: AuthEmailOptions) {
  return render(
    <EmailTemplate>
      <Preview>Your {process.env.APP_NAME} login code</Preview>
      <Body className="bg-white">
        <Container className="mx-auto py-4">
          <Heading className="text-2xl font-medium text-gray-800">
            Your login code for {process.env.APP_NAME}
          </Heading>
          {magicLink && (
            <Section className="py-4">
              <Button
                className="bg-slate-800 text-white font-semibold text-sm p-4"
                href={magicLink}
              >
                Login to {process.env.APP_NAME}
              </Button>
            </Section>
          )}
          <Text className="text-sm text-gray-800">
            This link and code will only be valid for the next 60 seconds. If
            the link does not work, you can use the login verification code
            directly:
          </Text>
          <code className="text-xl font-semibold">{code}</code>
          <Hr className="my-4 border-gray-500" />
          <Text className="text-sm text-gray-800">
            {new Date().getFullYear()}. Lagos, Nigeria
          </Text>
        </Container>
      </Body>
    </EmailTemplate>
  );
}
