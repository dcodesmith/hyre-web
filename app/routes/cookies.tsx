import type { ReactNode } from "react";
import { Link } from "react-router";

import { LegalPageLayout } from "~/components/legal/legal-page-layout";
import { Button } from "~/components/ui/button";
import { LEGAL_CONSTANTS } from "~/constants/legal";
import { useCookieConsent } from "~/hooks/use-cookie-consent";
import { buildPageMetadata, staticPageHeaders } from "~/lib/seo";

export const meta = () =>
  buildPageMetadata({
    title: "Cookie Policy | Tripdly",
    description:
      "Learn about the cookies used by Tripdly and how they help us provide our services.",
    path: "/cookies",
  });

export const headers = staticPageHeaders;

export default function CookiesPage() {
  const { companyName, privacyEmail } = LEGAL_CONSTANTS;

  return (
    <LegalPageLayout path="/cookies" title="Cookie Policy">
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">1. Introduction</h2>
        <p className="mb-4 text-gray-600">
          This Cookie Policy explains how {companyName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
          &ldquo;our&rdquo;) uses cookies and similar technologies when you visit our chauffeur
          booking platform. This policy should be read alongside our{" "}
          <Link to="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">2. What Are Cookies?</h2>
        <p className="mb-4 text-gray-600">
          Cookies are small text files that are stored on your device (computer, tablet, or mobile)
          when you visit a website. They are widely used to make websites work more efficiently and
          provide information to website owners.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">3. Cookies We Use</h2>
        <p className="mb-4 text-gray-600">
          We use <strong>strictly necessary cookies</strong> that are essential for our platform to
          function. Essential cookies do not require your consent because they are necessary to
          provide the service you have requested.
        </p>

        <div className="mb-4 overflow-x-auto">
          <table
            aria-label="Essential cookies"
            className="min-w-full rounded-lg border border-gray-200"
          >
            <caption className="sr-only">
              Essential cookies used by Tripdly regardless of consent
            </caption>
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  Cookie Name
                </th>
                <th className="border-b px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  Purpose
                </th>
                <th className="border-b px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-b px-4 py-3 text-sm text-gray-600">
                  <code className="rounded bg-gray-100 px-1">session_token</code>
                  <span className="block text-xs text-gray-500">
                    Production: __Host-session_token
                  </span>
                </td>
                <td className="border-b px-4 py-3 text-sm text-gray-600">
                  Maintains your authenticated session so you stay logged in while using the
                  platform
                </td>
                <td className="border-b px-4 py-3 text-sm text-gray-600">7 days</td>
              </tr>
              <tr>
                <td className="border-b px-4 py-3 text-sm text-gray-600">
                  <code className="rounded bg-gray-100 px-1">session_data</code>
                  <span className="block text-xs text-gray-500">
                    Production: __Host-session_data
                  </span>
                </td>
                <td className="border-b px-4 py-3 text-sm text-gray-600">
                  Caches session data briefly to reduce repeated authentication lookups
                </td>
                <td className="border-b px-4 py-3 text-sm text-gray-600">5 minutes</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="mt-6 mb-2 text-lg font-medium text-gray-900">
          Analytics Cookies (Optional)
        </h3>
        <p className="mb-4 text-gray-600">
          Tripdly does not currently set analytics cookies. Your choice below is stored on your
          device as <code className="rounded bg-gray-100 px-1">tripdly-cookie-consent:v1</code> in
          local storage, which is not a cookie. If an analytics provider is enabled later, we will
          update this policy with its cookie names, purpose, provider, and duration before setting
          optional cookies.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">4. Third-Party Cookies</h2>
        <p className="mb-4 text-gray-600">
          We do not use any third-party advertising or marketing cookies. Our platform does not
          share your browsing data with advertisers or marketing networks, and no third-party
          analytics cookies are currently configured.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">5. Manage Your Preferences</h2>
        <p className="mb-4 text-gray-600">
          You can change your cookie preferences at any time using the controls below:
        </p>
        <CookiePreferencesManager />
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">6. Browser Cookie Settings</h2>
        <p className="mb-4 text-gray-600">
          Most web browsers allow you to control cookies through their settings. You can usually
          find these settings in the &ldquo;Options&rdquo; or &ldquo;Preferences&rdquo; menu of your
          browser. However, please note that disabling essential cookies may prevent you from using
          certain features of our platform, including the ability to log in.
        </p>
        <p className="mb-4 text-gray-600">
          For more information about how to manage cookies in popular browsers:
        </p>
        <ul className="mb-4 list-disc pl-6 text-gray-600">
          <li>
            <ExternalLink href="https://support.google.com/chrome/answer/95647">
              Google Chrome
            </ExternalLink>
          </li>
          <li>
            <ExternalLink href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer">
              Mozilla Firefox
            </ExternalLink>
          </li>
          <li>
            <ExternalLink href="https://support.apple.com/en-ng/guide/safari/sfri11471/mac">
              Safari
            </ExternalLink>
          </li>
          <li>
            <ExternalLink href="https://support.microsoft.com/en-us/windows/delete-and-manage-cookies-168dab11-0753-043d-7c16-ede5947fc64d">
              Microsoft Edge
            </ExternalLink>
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">7. Changes to This Policy</h2>
        <p className="mb-4 text-gray-600">
          We may update this Cookie Policy from time to time to reflect changes in technology or
          legal requirements. Any changes will be posted on this page with an updated revision date.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">8. Contact Us</h2>
        <p className="mb-4 text-gray-600">
          If you have any questions about our use of cookies, please contact us at:
        </p>
        <address className="not-italic text-gray-600">
          <strong>{companyName}</strong>
          <br />
          Email:{" "}
          <a href={`mailto:${privacyEmail}`} className="text-primary hover:underline">
            {privacyEmail}
          </a>
          <br />
          Lagos, Nigeria
        </address>
      </section>
    </LegalPageLayout>
  );
}

function CookiePreferencesManager() {
  const { consent, isLoaded, hasConsented, acceptAll, declineAll } = useCookieConsent();

  if (!isLoaded) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-500">Loading preferences...</p>
      </div>
    );
  }

  let preferenceMessage = "You haven't set your cookie preferences yet.";
  if (hasConsented) {
    preferenceMessage = consent?.analytics
      ? "You have accepted analytics cookies."
      : "You have declined analytics cookies.";
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite">
          <p className="text-sm font-medium text-gray-900">Analytics Cookies</p>
          <p className="text-sm text-gray-600">{preferenceMessage}</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={acceptAll}
            size="sm"
            variant={consent?.analytics ? "default" : "outline"}
          >
            Accept
          </Button>
          <Button
            onClick={declineAll}
            size="sm"
            variant={hasConsented && !consent?.analytics ? "default" : "outline"}
          >
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ExternalLinkProps {
  readonly children: ReactNode;
  readonly href: string;
}

function ExternalLink({ children, href }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {children}
    </a>
  );
}
