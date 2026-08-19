import { Mail, MapPin, Phone } from "lucide-react";
import { Link } from "react-router";

import { FacebookIcon, InstagramIcon, XIcon } from "~/components/icons/social-icons";
import { LEGAL_CONSTANTS } from "~/content/legal";

const serviceLinks = [
  { to: "/chauffeur-service-lagos", label: "Chauffeur Service Lagos" },
  { to: "/?bookingType=AIRPORT_PICKUP", label: "Airport Pickup" },
  { to: "/?bookingType=DAY", label: "Day Rentals" },
  { to: "/?bookingType=NIGHT", label: "Night Service" },
  { to: "/?bookingType=FULL_DAY", label: "Full Day Charter" },
  { to: "/#luxury", label: "Luxury Vehicles" },
  { to: "/#executive", label: "Executive Cars" },
] as const;

const categoryLinks = [
  { to: "/#suvs", label: "SUVs" },
  { to: "/#sedans", label: "Sedans" },
  { to: "/#luxury", label: "Luxury" },
  { to: "/#executive", label: "Executive" },
  { to: "/#budget", label: "Budget-Friendly" },
  { to: "/#popular", label: "Most Popular" },
] as const;

const companyLinks = [
  { to: "/about", label: "About Us" },
  { to: "/fleet-owner/login", label: "Become a Fleet Owner" },
  { to: "/referrals", label: "Referral Program" },
  { to: "/faq", label: "FAQ" },
  { to: "/help", label: "Help Center" },
  { to: "/contact", label: "Contact Us" },
  { to: "/safety", label: "Safety & Security" },
] as const;

const legalLinks = [
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms of Service" },
  { to: "/cookies", label: "Cookie Policy" },
  { to: "/accessibility", label: "Accessibility" },
] as const;

const linkClassName = "text-sm text-gray-600 transition-colors hover:text-gray-900";

interface FooterLink {
  readonly label: string;
  readonly to: string;
}

interface FooterLinkListProps {
  readonly links: readonly FooterLink[];
}

function FooterLinkList({ links }: FooterLinkListProps) {
  return (
    <ul className="flex flex-col gap-2.5">
      {links.map((link) => (
        <li key={link.to}>
          <Link to={link.to} className={linkClassName}>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 pb-24 md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          <div className="flex flex-col gap-4">
            <h2 translate="no" className="font-brand text-lg font-bold">
              {LEGAL_CONSTANTS.companyName}
            </h2>
            <p className="text-sm leading-relaxed text-gray-600">
              Professional chauffeur services with vetted drivers and premium vehicles. Your comfort
              and safety are our priority.
            </p>
            <div className="flex gap-4">
              <a
                href="https://facebook.com/tripdly"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 transition-colors hover:text-gray-600"
                aria-label="Tripdly on Facebook"
              >
                <FacebookIcon className="size-5" />
              </a>
              <a
                href="https://instagram.com/tripdly"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 transition-colors hover:text-gray-600"
                aria-label="Tripdly on Instagram"
              >
                <InstagramIcon className="size-5" />
              </a>
              <a
                href="https://x.com/tripdly"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 transition-colors hover:text-gray-600"
                aria-label="Tripdly on X"
              >
                <XIcon className="size-5" />
              </a>
            </div>
          </div>

          <div>
            <h2 className="mb-4 font-semibold text-gray-900">Popular Services</h2>
            <FooterLinkList links={serviceLinks} />
          </div>

          <div>
            <h2 className="mb-4 font-semibold text-gray-900">Vehicle Categories</h2>
            <FooterLinkList links={categoryLinks} />
          </div>

          <div>
            <h2 className="mb-4 font-semibold text-gray-900">Company</h2>
            <FooterLinkList links={companyLinks} />
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 border-t border-gray-200 pt-8 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">Visit Us</p>
              <p className="mt-1 text-sm text-gray-600">Lagos, Nigeria</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">Call Us</p>
              <a
                href={`tel:${LEGAL_CONSTANTS.supportPhone}`}
                className="mt-1 block text-sm text-gray-600 hover:text-gray-900"
              >
                {LEGAL_CONSTANTS.supportPhoneDisplay}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">Email Us</p>
              <a
                href={`mailto:${LEGAL_CONSTANTS.supportEmail}`}
                className="mt-1 block text-sm text-gray-600 hover:text-gray-900"
              >
                {LEGAL_CONSTANTS.supportEmail}
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-8">
          <h2 className="mb-3 font-semibold text-gray-900">Premium Chauffeur Service in Nigeria</h2>
          <p className="max-w-4xl text-sm leading-relaxed text-gray-600">
            {LEGAL_CONSTANTS.companyName} offers professional chauffeur services across Nigeria with
            a diverse fleet of luxury sedans, executive SUVs, and budget-friendly vehicles. Whether
            you need airport pickup, full-day charter, or hourly rentals, our vetted drivers ensure
            safe, comfortable, and reliable transportation.
          </p>
        </div>
      </div>

      <div className="border-t border-gray-200 bg-gray-100">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 md:flex-row md:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-600 md:text-left">
            ©{" "}
            <span data-visual-dynamic suppressHydrationWarning>
              {new Date().getFullYear()}
            </span>{" "}
            <span translate="no">{LEGAL_CONSTANTS.companyName}</span>. All rights reserved.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap justify-center gap-6">
            {legalLinks.map((link) => (
              <Link key={link.to} to={link.to} className={linkClassName}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
