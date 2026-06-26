import { Link, type MetaFunction } from "react-router";
import { Button } from "~/components/ui/button";
import { LEGAL_CONSTANTS } from "~/constants/legal";
import { useCookieConsent } from "~/hooks/useCookieConsent";
import { generateMetaTags } from "~/utils/seo";
import { env } from "~/utils/server/env.server";

export async function loader() {
  return { ENV: { DOMAIN: env.DOMAIN } };
}

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const baseUrl = loaderData?.ENV?.DOMAIN ?? "http://localhost:5173";

  return generateMetaTags({
    title: "Cookie Policy | Tripdly",
    description:
      "Learn about the cookies used by Tripdly and how they help us provide our services.",
    url: `${baseUrl}/cookies`,
    canonical: `${baseUrl}/cookies`,
    image: `${baseUrl}/og-image.jpg`,
  });
};

function CookiePreferencesManager() {
  const { consent, isLoaded, hasConsented, acceptAll, declineAll } = useCookieConsent();

  if (!isLoaded) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500">Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Analytics Cookies</p>
          <p className="text-sm text-gray-600">
            {hasConsented
              ? consent?.analytics
                ? "You have accepted analytics cookies."
                : "You have declined analytics cookies."
              : "You haven't set your cookie preferences yet."}
          </p>
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

export default function CookiePolicy() {
  const { lastUpdated, companyName, privacyEmail: contactEmail } = LEGAL_CONSTANTS;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-gray max-w-none">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: {lastUpdated}</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-600 mb-4">
              This Cookie Policy explains how {companyName} ("we", "us", or "our") uses cookies and
              similar technologies when you visit our chauffeur booking platform. This policy should
              be read alongside our{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2. What Are Cookies?</h2>
            <p className="text-gray-600 mb-4">
              Cookies are small text files that are stored on your device (computer, tablet, or
              mobile) when you visit a website. They are widely used to make websites work more
              efficiently and provide information to website owners.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Cookies We Use</h2>
            <p className="text-gray-600 mb-4">
              We use <strong>strictly necessary cookies</strong> that are essential for our platform
              to function, plus optional <strong>analytics cookies</strong> to help us improve our
              services. Essential cookies do not require your consent as they are necessary to
              provide the service you have requested.
            </p>

            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border border-gray-200 rounded-lg">
                <caption className="sr-only">
                  Essential cookies used by Tripdly regardless of consent
                </caption>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b">
                      Cookie Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b">
                      Purpose
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-600 border-b">
                      <code className="bg-gray-100 px-1 rounded">better-auth.session_token</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 border-b">
                      Maintains your authenticated session so you stay logged in while using the
                      platform
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 border-b">7 days</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-600 border-b">
                      <code className="bg-gray-100 px-1 rounded">__session</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 border-b">
                      Stores temporary session data during the authentication flow (email
                      verification)
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 border-b">Session</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-600 border-b">
                      <code className="bg-gray-100 px-1 rounded">csrf_token</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 border-b">
                      Protects against cross-site request forgery attacks to keep your account
                      secure
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 border-b">Session</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mb-2 mt-6">
              Analytics Cookies (Optional)
            </h3>
            <p className="text-gray-600 mb-4">
              With your consent, we use analytics cookies to understand how visitors interact with
              our platform. This helps us improve our services. These cookies are only set if you
              accept them.
            </p>

            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border border-gray-200 rounded-lg">
                <caption className="sr-only">
                  Optional analytics cookies set only if you accept analytics
                </caption>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b">
                      Cookie Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b">
                      Purpose
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b">
                      Provider
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <code className="bg-gray-100 px-1 rounded">_vercel_insights</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      Collects anonymous usage data to help us understand how visitors use our
                      platform and identify performance issues
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">Vercel Analytics</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Third-Party Cookies</h2>
            <p className="text-gray-600 mb-4">
              We do not use any third-party advertising or marketing cookies. Our platform does not
              share your browsing data with advertisers or marketing networks. The only third-party
              service we use (with your consent) is Vercel Analytics for anonymous usage statistics.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Manage Your Preferences</h2>
            <p className="text-gray-600 mb-4">
              You can change your cookie preferences at any time using the controls below:
            </p>
            <CookiePreferencesManager />
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Browser Cookie Settings</h2>
            <p className="text-gray-600 mb-4">
              Most web browsers allow you to control cookies through their settings. You can usually
              find these settings in the "Options" or "Preferences" menu of your browser. However,
              please note that disabling essential cookies may prevent you from using certain
              features of our platform, including the ability to log in.
            </p>
            <p className="text-gray-600 mb-4">
              For more information about how to manage cookies in popular browsers:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>
                <a
                  href="https://support.google.com/chrome/answer/95647"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google Chrome
                </a>
              </li>
              <li>
                <a
                  href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Mozilla Firefox
                </a>
              </li>
              <li>
                <a
                  href="https://support.apple.com/en-ng/guide/safari/sfri11471/mac"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Safari
                </a>
              </li>
              <li>
                <a
                  href="https://support.microsoft.com/en-us/windows/delete-and-manage-cookies-168dab11-0753-043d-7c16-ede5947fc64d"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Microsoft Edge
                </a>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Changes to This Policy</h2>
            <p className="text-gray-600 mb-4">
              We may update this Cookie Policy from time to time to reflect changes in technology or
              legal requirements. Any changes will be posted on this page with an updated revision
              date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Contact Us</h2>
            <p className="text-gray-600 mb-4">
              If you have any questions about our use of cookies, please contact us at:
            </p>
            <address className="text-gray-600 not-italic">
              <strong>{companyName}</strong>
              <br />
              Email:{" "}
              <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                {contactEmail}
              </a>
              <br />
              Lagos, Nigeria
            </address>
          </section>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <Link to="/" className="text-primary hover:underline">
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
