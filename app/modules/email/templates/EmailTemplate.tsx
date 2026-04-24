import type * as React from "react";
import {
  Body,
  Container,
  Font,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "react-email";
import { getEmailPublicEnv } from "../email-public-env";

const COMPANY_ADDRESS = "Lagos, Nigeria";
const CURRENT_YEAR = new Date().getFullYear();

interface EmailTemplateProps {
  readonly children: React.ReactNode;
  readonly previewText: string;
  readonly pageTitle?: string;
}

export function EmailTemplate({ children, previewText, pageTitle }: EmailTemplateProps) {
  const effectivePageTitle = pageTitle || previewText;
  const { appName: companyName, domain: websiteUrl, supportEmail } = getEmailPublicEnv();

  return (
    <Tailwind config={{ presets: [pixelBasedPreset] }}>
      <Html lang="en">
        <Head>
          <title>{effectivePageTitle}</title>
          <Font
            fontFamily="Nunito Sans"
            fallbackFontFamily={["Arial", "sans-serif"]}
            webFont={{
              url: "https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,wght@0,200..900;1,200..900&display=swap",
              format: "woff2",
            }}
            fontWeight={400}
            fontStyle="normal"
          />
          <style>
            {`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');`}
          </style>
          <Preview>{previewText}</Preview>
        </Head>
        <Body
          className="bg-[#F4F4F5] m-0 py-8"
          style={{ fontFamily: '"Nunito Sans", Arial, sans-serif' }}
        >
          <Container className="max-w-[560px] mx-auto">
            <Section className="bg-white rounded-[16px] overflow-hidden">
              <Section className="px-8 pt-8 pb-2">
                <Text
                  className="text-[28px] leading-[32px] text-[#0B0B0F] m-0"
                  style={{ fontFamily: '"Dancing Script", cursive', fontWeight: 700 }}
                >
                  {companyName}
                </Text>
              </Section>
              <Section className="px-8 pb-8 pt-4">{children}</Section>
            </Section>

            <Section className="px-8 pt-6">
              <Text className="text-[12px] text-[#6A6A71] m-0 leading-5">
                Need a hand?{" "}
                <Link
                  href={`mailto:${supportEmail}`}
                  className="text-[#0B0B0F] font-medium underline"
                >
                  {supportEmail}
                </Link>
              </Text>
              <Text className="text-[12px] text-[#9A9A9F] mt-4 m-0 leading-5">
                &copy; {CURRENT_YEAR} {companyName} &middot; {COMPANY_ADDRESS}
              </Text>
              {websiteUrl && websiteUrl !== "#" && (
                <Text className="text-[12px] text-[#9A9A9F] mt-1 m-0 leading-5">
                  <Link href={websiteUrl} className="text-[#9A9A9F] underline">
                    {websiteUrl.replace(/^https?:\/\//, "")}
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
