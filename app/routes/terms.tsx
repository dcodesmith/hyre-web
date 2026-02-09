import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { LEGAL_CONSTANTS } from "~/constants/legal";

export const meta: MetaFunction = () => {
  return [
    { title: "Terms of Service | Tripdly" },
    {
      name: "description",
      content: "Terms and conditions for using Tripdly chauffeur booking services.",
    },
  ];
};

export default function TermsOfService() {
  const { lastUpdated, companyName, supportEmail: contactEmail } = LEGAL_CONSTANTS;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-gray max-w-none">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: {lastUpdated}</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-600 mb-4">
              By accessing or using {companyName} ("the Platform"), you agree to be bound by these
              Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-600 mb-4">
              {companyName} is a platform that connects customers with professional chauffeur
              services. We facilitate bookings between customers and fleet owners/chauffeurs but are
              not ourselves a transportation provider.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">3. User Accounts</h2>

            <h3 className="text-lg font-medium text-gray-900 mb-2">3.1 Registration</h3>
            <p className="text-gray-600 mb-4">
              To use our services, you must create an account by providing accurate and complete
              information. You are responsible for maintaining the confidentiality of your account
              credentials.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-2">3.2 Eligibility</h3>
            <p className="text-gray-600 mb-4">
              You must be at least 18 years old to use our services. By using the Platform, you
              represent that you meet this requirement.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-2">3.3 Account Security</h3>
            <p className="text-gray-600 mb-4">
              You are responsible for all activities under your account. Notify us immediately of
              any unauthorized access or security breach.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Booking Services</h2>

            <h3 className="text-lg font-medium text-gray-900 mb-2">4.1 Booking Process</h3>
            <p className="text-gray-600 mb-4">
              When you make a booking, you enter into a service agreement with the fleet
              owner/chauffeur. {companyName} facilitates this transaction but is not a party to the
              transportation contract.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-2">4.2 Pricing</h3>
            <p className="text-gray-600 mb-4">
              All prices displayed include applicable fees. VAT is calculated and displayed
              separately. Prices may vary based on vehicle type, duration, and service tier.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-2">4.3 Payment</h3>
            <p className="text-gray-600 mb-4">
              Payment is processed securely through our payment provider. Full payment is required
              to confirm a booking. We accept various payment methods as displayed at checkout.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-2">4.4 Cancellation</h3>
            <p className="text-gray-600 mb-4">
              Cancellation policies vary by booking type. Refunds, if applicable, will be processed
              according to our refund policy. Some bookings may be non-refundable after
              confirmation.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Fleet Owner Terms</h2>

            <h3 className="text-lg font-medium text-gray-900 mb-2">5.1 Registration Requirements</h3>
            <p className="text-gray-600 mb-2">Fleet owners must provide:</p>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>Valid National Identification Number (NIN)</li>
              <li>Valid driver's license</li>
              <li>LASDRI certification (where applicable)</li>
              <li>Vehicle registration and insurance documents</li>
              <li>Bank account details for payouts</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">5.2 Vehicle Standards</h3>
            <p className="text-gray-600 mb-4">
              All vehicles must meet our quality and safety standards. We reserve the right to
              reject or remove vehicles that do not meet these standards.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-2">5.3 Commission</h3>
            <p className="text-gray-600 mb-4">
              Fleet owners agree to pay a platform commission on completed bookings. Commission
              rates are displayed in your fleet owner dashboard. Payouts are processed according to
              our payout schedule.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">6. User Conduct</h2>
            <p className="text-gray-600 mb-2">You agree not to:</p>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>Provide false or misleading information</li>
              <li>Use the Platform for any unlawful purpose</li>
              <li>Interfere with the Platform's operation</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Circumvent our payment systems</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Reviews and Ratings</h2>
            <p className="text-gray-600 mb-4">
              Users may leave reviews and ratings after completed bookings. Reviews must be honest,
              accurate, and not contain offensive content. We reserve the right to moderate or
              remove reviews that violate our guidelines.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Intellectual Property</h2>
            <p className="text-gray-600 mb-4">
              All content on the Platform, including logos, text, graphics, and software, is the
              property of {companyName} or its licensors. You may not copy, modify, or distribute
              this content without our written permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-600 mb-4">
              {companyName} acts as an intermediary between customers and fleet owners. We are not
              liable for:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>The conduct of fleet owners or chauffeurs</li>
              <li>Vehicle conditions or safety</li>
              <li>Delays, cancellations, or service quality issues</li>
              <li>Loss or damage to personal property during transport</li>
              <li>Indirect, incidental, or consequential damages</li>
            </ul>
            <p className="text-gray-600 mb-4">
              Our total liability is limited to the amount you paid for the booking in question.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Indemnification</h2>
            <p className="text-gray-600 mb-4">
              You agree to indemnify and hold {companyName} harmless from any claims, damages, or
              expenses arising from your use of the Platform or violation of these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Privacy</h2>
            <p className="text-gray-600 mb-4">
              Your use of the Platform is also governed by our{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              , which explains how we collect, use, and protect your personal data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">12. Modifications</h2>
            <p className="text-gray-600 mb-4">
              We may modify these Terms at any time. We will notify you of significant changes via
              email or through the Platform. Your continued use after changes constitutes acceptance
              of the modified Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">13. Termination</h2>
            <p className="text-gray-600 mb-4">
              We may suspend or terminate your account for violations of these Terms or for any
              other reason at our discretion. You may close your account at any time by contacting
              us. Upon termination, your right to use the Platform ceases immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">14. Governing Law</h2>
            <p className="text-gray-600 mb-4">
              These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes
              shall be resolved in the courts of Lagos State, Nigeria.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">15. Contact Us</h2>
            <p className="text-gray-600 mb-4">
              For questions about these Terms, contact us at:
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
