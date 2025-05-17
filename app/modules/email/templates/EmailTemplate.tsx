import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";
import * as React from "react";
import tailwindConfig from "tailwind.config";

// Sourcing company details from environment variables for a Remix app (server-side)
const COMPANY_NAME = process.env.APP_NAME || "Your Company Name";
const COMPANY_LOGO_URL =
  process.env.COMPANY_LOGO_URL || "https://via.placeholder.com/150x50?text=Your+Logo";
const COMPANY_ADDRESS = process.env.COMPANY_ADDRESS || "Lagos, Nigeria";
const WEBSITE_URL = process.env.WEBSITE_URL || process.env.DOMAIN || "https://dcodesmith.com";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@dcodesmith.com";
const CURRENT_YEAR = new Date().getFullYear();

interface EmailTemplateProps {
  children: React.ReactNode;
  previewText: string;
  pageTitle?: string;
}

export function EmailTemplate({ children, previewText, pageTitle }: EmailTemplateProps) {
  const effectivePageTitle = pageTitle || previewText;

  return (
    <Tailwind config={tailwindConfig}>
      <Html lang="en">
        <Head>
          <title className="capitalize">{effectivePageTitle.toLowerCase()}</title>
          <Font
            fontFamily="Nunito Sans"
            fallbackFontFamily="sans-serif"
            webFont={{
              url: "https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,wght@0,200..900;1,200..900&display=swap",
              format: "woff2",
            }}
            fontWeight={400}
            fontStyle="normal"
          />
          <Preview>{previewText}</Preview>
        </Head>
        <Body className="bg-gray-100 text-gray-800 font-sans text-base leading-relaxed">
          <Container className="bg-white border border-gray-200 rounded-md shadow-sm mx-auto my-8 p-6 sm:p-8 max-w-xl">
            <Section className="mb-6 text-center">
              <Img
                src={COMPANY_LOGO_URL}
                alt={`${COMPANY_NAME} Logo`}
                width="150"
                height="auto"
                className="mx-auto mb-4"
              />
            </Section>

            <Section>{children}</Section>

            <Hr className="my-6 border-gray-300" />
            <Section className="text-center text-xs text-gray-500">
              <Text className="mb-1">
                &copy; {CURRENT_YEAR} {COMPANY_NAME}. All rights reserved.
              </Text>
              {COMPANY_ADDRESS && <Text className="mb-1">{COMPANY_ADDRESS}</Text>}
              {WEBSITE_URL && WEBSITE_URL !== "#" && (
                <Text className="mb-1">
                  <Link href={WEBSITE_URL} className="text-blue-600 hover:underline">
                    Visit our website
                  </Link>
                </Text>
              )}
              {SUPPORT_EMAIL && (
                <Text>
                  Need help? Contact{" "}
                  <Link href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 hover:underline">
                    {SUPPORT_EMAIL}
                  </Link>
                </Text>
              )}
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}
