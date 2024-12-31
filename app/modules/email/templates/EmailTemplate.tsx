import { Font, Head, Html, Tailwind } from "@react-email/components";
import tailwindConfig from "tailwind.config";

export function EmailTemplate({ children }: { children: React.ReactNode }) {
  return (
    <Tailwind config={tailwindConfig}>
      <Html>
        <Head>
          <Font
            fontFamily="Nunito Sans"
            fallbackFontFamily="sans-serif"
            webFont={{
              url: "https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,wght@0,200..900;1,200..900&display=swap",
              format: "woff",
            }}
          />
        </Head>
        {children}
      </Html>
    </Tailwind>
  );
}
