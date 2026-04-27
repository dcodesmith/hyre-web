import { Mail, MapPin, Phone } from "lucide-react";
import { Link } from "react-router";
import { FacebookIcon } from "~/components/icons/FacebookIcon";
import { InstagramIcon } from "~/components/icons/InstagramIcon";
import { XIcon } from "~/components/icons/XIcon";
import { cn } from "~/lib/utils";

interface FooterProps {
  readonly appName: string;
  readonly isCarDetailPage: boolean;
}

export function Footer({ appName, isCarDetailPage }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "bg-gray-50 border-t border-gray-200",
        isCarDetailPage && "hidden lg:block lg:mt-10",
      )}
    >
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Company Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold font-dancingscript">{appName}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Professional chauffeur services with vetted drivers and premium vehicles. Your comfort
              and safety are our priority.
            </p>
            <div className="flex gap-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Tripdly on Facebook"
              >
                <FacebookIcon size={20} className="h-5 w-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Tripdly on Instagram"
              >
                <InstagramIcon size={20} className="h-5 w-5" />
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Tripdly on X"
              >
                <XIcon size={20} className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Popular Services */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Popular Services</h4>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/chauffeur-service-lagos"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Chauffeur Service Lagos
                </Link>
              </li>
              <li>
                <Link
                  to="/?bookingType=AIRPORT_PICKUP"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Airport Pickup
                </Link>
              </li>
              <li>
                <Link
                  to="/?bookingType=DAY"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Day Rentals
                </Link>
              </li>
              <li>
                <Link
                  to="/?bookingType=NIGHT"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Night Service
                </Link>
              </li>
              <li>
                <Link
                  to="/?bookingType=FULL_DAY"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Full Day Charter
                </Link>
              </li>
              <li>
                <Link
                  to="/#luxury"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Luxury Vehicles
                </Link>
              </li>
              <li>
                <Link
                  to="/#executive"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Executive Cars
                </Link>
              </li>
            </ul>
          </div>

          {/* Vehicle Categories */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Vehicle Categories</h4>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/#suvs"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  SUVs
                </Link>
              </li>
              <li>
                <Link
                  to="/#sedans"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Sedans
                </Link>
              </li>
              <li>
                <Link
                  to="/#luxury"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Luxury
                </Link>
              </li>
              <li>
                <Link
                  to="/#executive"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Executive
                </Link>
              </li>
              <li>
                <Link
                  to="/#budget"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Budget-Friendly
                </Link>
              </li>
              <li>
                <Link
                  to="/#popular"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Most Popular
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Support */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/about"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  to="/fleet-owner/login"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Become a Fleet Owner
                </Link>
              </li>
              <li>
                <Link
                  to="/referrals"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Referral Program
                </Link>
              </li>
              <li>
                <Link
                  to="/faq"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  to="/help"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  to="/safety"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Safety & Security
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Contact Information */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Visit Us</p>
                <p className="text-sm text-gray-600 mt-1">Lagos, Nigeria</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Call Us</p>
                <a
                  href="tel:+2340123456789"
                  className="text-sm text-gray-600 hover:text-gray-900 mt-1 block"
                >
                  +234 (0) 123 4567 89
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Email Us</p>
                <a
                  href="mailto:support@example.com"
                  className="text-sm text-gray-600 hover:text-gray-900 mt-1 block"
                >
                  support@tripdly.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* SEO-Rich Description */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Premium Chauffeur Service in Nigeria</h4>
          <p className="text-sm text-gray-600 leading-relaxed max-w-4xl">
            {appName} offers professional chauffeur services across Nigeria with a diverse fleet of
            luxury sedans, executive SUVs, and budget-friendly vehicles. Whether you need airport
            pickup, full-day charter, or hourly rentals, our vetted drivers ensure safe,
            comfortable, and reliable transportation. Book online instantly with real-time
            availability, transparent pricing, and 24/7 customer support.
          </p>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-gray-100 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-600 text-center md:text-left">
              © {currentYear} {appName}. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <Link
                to="/privacy"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                to="/cookies"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cookie Policy
              </Link>
              <Link
                to="/accessibility"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Accessibility
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
