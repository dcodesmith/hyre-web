import { type MetaFunction, Link } from "react-router";
import { LEGAL_CONSTANTS } from "~/constants/legal";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy | Tripdly" },
    {
      name: "description",
      content:
        "Learn how Tripdly collects, uses, and protects your personal data in compliance with NDPC regulations.",
    },
  ];
};

export default function PrivacyPolicy() {
  const { lastUpdated, companyName, privacyEmail: contactEmail } = LEGAL_CONSTANTS;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-gray max-w-none">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: {lastUpdated}</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-600 mb-4">
              {companyName} ("we", "us", or "our") is committed to protecting your personal data in
              accordance with the Nigeria Data Protection Regulation (NDPR) and the Nigeria Data
              Protection Act (NDPA). This Privacy Policy explains how we collect, use, disclose, and
              safeguard your information when you use our chauffeur booking platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-gray-900 mb-2">2.1 Personal Information</h3>
            <p className="text-gray-600 mb-2">We collect the following personal data:</p>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>
                <strong>Identity Data:</strong> Full name, email address, phone number
              </li>
              <li>
                <strong>Contact Data:</strong> Address, city
              </li>
              <li>
                <strong>Booking Data:</strong> Pickup/drop-off locations, travel dates, special
                requests
              </li>
              <li>
                <strong>Payment Data:</strong> Transaction records (processed securely by our
                payment provider)
              </li>
              <li>
                <strong>Technical Data:</strong> IP address, browser type, device information
              </li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">
              2.2 Fleet Owner Additional Data
            </h3>
            <p className="text-gray-600 mb-2">If you register as a fleet owner, we also collect:</p>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>National Identification Number (NIN)</li>
              <li>Driver's license details</li>
              <li>LASDRI certification</li>
              <li>Vehicle registration and insurance documents</li>
              <li>Bank account details for payouts</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              3. How We Use Your Information
            </h2>
            <p className="text-gray-600 mb-2">We use your personal data to:</p>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>Process and manage your bookings</li>
              <li>Verify fleet owner identities and qualifications</li>
              <li>Process payments and payouts</li>
              <li>Send booking confirmations and updates</li>
              <li>Provide customer support</li>
              <li>Improve our services</li>
              <li>Comply with legal obligations</li>
              <li>Detect and prevent fraud</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              4. Legal Basis for Processing
            </h2>
            <p className="text-gray-600 mb-2">We process your data based on:</p>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>
                <strong>Contract:</strong> To fulfill our booking services agreement with you
              </li>
              <li>
                <strong>Consent:</strong> When you explicitly agree to specific data processing
              </li>
              <li>
                <strong>Legal Obligation:</strong> To comply with Nigerian laws and regulations
              </li>
              <li>
                <strong>Legitimate Interest:</strong> For fraud prevention and service improvement
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Data Sharing</h2>
            <p className="text-gray-600 mb-2">We share your data with:</p>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>
                <strong>Fleet Owners/Chauffeurs:</strong> To fulfill your booking (name, phone,
                pickup details)
              </li>
              <li>
                <strong>Payment Processors:</strong> Flutterwave for secure payment processing
              </li>
              <li>
                <strong>Communication Services:</strong> For email and SMS notifications
              </li>
              <li>
                <strong>Cloud Storage:</strong> AWS for secure document storage
              </li>
              <li>
                <strong>Flight Tracking:</strong> FlightAware for airport pickup coordination
              </li>
            </ul>
            <p className="text-gray-600 mb-4">
              We do not sell your personal data to third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Data Retention</h2>
            <p className="text-gray-600 mb-4">
              We retain your personal data for as long as necessary to provide our services and
              comply with legal obligations. Booking records are retained for 7 years for tax and
              legal purposes. You may request deletion of your account at any time, subject to legal
              retention requirements.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Your Rights</h2>
            <p className="text-gray-600 mb-2">Under NDPR/NDPA, you have the right to:</p>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>
                <strong>Access:</strong> Request a copy of your personal data
              </li>
              <li>
                <strong>Rectification:</strong> Correct inaccurate or incomplete data
              </li>
              <li>
                <strong>Erasure:</strong> Request deletion of your data (subject to legal
                requirements)
              </li>
              <li>
                <strong>Portability:</strong> Receive your data in a machine-readable format
              </li>
              <li>
                <strong>Object:</strong> Object to certain processing activities
              </li>
              <li>
                <strong>Withdraw Consent:</strong> Withdraw consent where processing is based on
                consent
              </li>
            </ul>
            <p className="text-gray-600 mb-4">
              To exercise these rights, contact us at{" "}
              <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                {contactEmail}
              </a>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Data Security</h2>
            <p className="text-gray-600 mb-4">
              We implement appropriate technical and organizational measures to protect your data,
              including:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>Encryption of data in transit (HTTPS/TLS)</li>
              <li>Secure authentication with one-time passwords</li>
              <li>Access controls and audit logging</li>
              <li>Regular security assessments</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Cookies</h2>
            <p className="text-gray-600 mb-4">
              We use essential cookies to operate our platform. For details on our cookie usage,
              please see our{" "}
              <Link to="/cookies" className="text-primary hover:underline">
                Cookie Policy
              </Link>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Changes to This Policy</h2>
            <p className="text-gray-600 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes by email or through a notice on our platform. Your continued use of our
              services after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Contact Us</h2>
            <p className="text-gray-600 mb-4">
              For questions about this Privacy Policy or to exercise your data rights, contact us
              at:
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

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">12. Regulatory Authority</h2>
            <p className="text-gray-600 mb-4">
              If you have concerns about our data practices, you may lodge a complaint with the
              Nigeria Data Protection Commission (NDPC) at{" "}
              <a
                href="https://ndpc.gov.ng"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                ndpc.gov.ng
              </a>
              .
            </p>
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
