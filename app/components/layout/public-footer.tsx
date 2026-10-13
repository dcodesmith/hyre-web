import { cn } from "cn";
import { Link } from "react-router";
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
  { to: "/safety", label: "Safety & Security" },
] as const;

const legalLinks = [
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms of Service" },
  { to: "/cookies", label: "Cookie Policy" },
  { to: "/accessibility", label: "Accessibility" },
] as const;

const socialLinks = [
  {
    href: "https://facebook.com/tripdly",
    label: "Tripdly on Facebook",
    src: "/footer/facebook.svg",
  },
  {
    href: "https://instagram.com/tripdly",
    label: "Tripdly on Instagram",
    src: "/footer/instagram.svg",
  },
  { href: "https://x.com/tripdly", label: "Tripdly on X", src: "/footer/x.svg" },
  {
    href: "https://linkedin.com/company/tripdly",
    label: "Tripdly on LinkedIn",
    src: "/footer/linkedin.svg",
  },
  // ponytail: @tripdly matches the other profiles; replace when a real YouTube URL exists
  { href: "https://youtube.com/@tripdly", label: "Tripdly on YouTube", src: "/footer/youtube.svg" },
] as const;

const linkClassName =
  "rounded-sm touch-manipulation transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black";

interface FooterLink {
  readonly label: string;
  readonly to: string;
}

function FooterColumn({
  title,
  links,
}: {
  readonly title: string;
  readonly links: readonly FooterLink[];
}) {
  const headingId = `footer-${title.toLowerCase().replaceAll(" ", "-")}`;

  return (
    <nav aria-labelledby={headingId} className="flex shrink-0 flex-col gap-3">
      <h2 id={headingId} className="text-pretty font-semibold">
        {title}
      </h2>
      <ul className="flex flex-col gap-4">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className={linkClassName}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function StoreBadge({
  src,
  caption,
  title,
}: {
  readonly src: string;
  readonly caption: string;
  readonly title: string;
}) {
  return (
    <div className="inline-flex items-center gap-[11.55px] rounded-[7.7px] bg-white/5 px-[11.55px] py-[7.7px] font-[Outfit,var(--font-sans)] text-white lg:gap-[12.965px] lg:rounded-[8.643px] lg:px-[12.965px] lg:py-[8.643px]">
      <img
        src={src}
        alt=""
        width={29}
        height={35}
        loading="lazy"
        aria-hidden="true"
        className="h-[30.79px] w-[26.17px] lg:h-[34.574px] lg:w-[29.387px]"
      />
      <span className="whitespace-nowrap">
        <span className="block text-[11.55px] leading-[16.36px] font-normal lg:text-[12.965px] lg:leading-[18.367px]">
          {caption}
        </span>
        <span className="block text-[19.25px] leading-[22.13px] font-semibold lg:text-[21.609px] lg:leading-[24.85px]">
          {title}
        </span>
      </span>
    </div>
  );
}

export function PublicFooter({ isCarDetailPage = false }: { readonly isCarDetailPage?: boolean }) {
  return (
    <footer
      className={cn(
        "bg-black font-sans text-sm leading-5 text-gray-200",
        isCarDetailPage ? "hidden lg:mt-10 lg:block" : "pb-24 md:pb-0",
      )}
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[73px] px-5 pt-10 pb-[105px] lg:px-10 lg:pt-[119px] lg:pb-[109px]">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:flex lg:items-start lg:justify-between">
          <FooterColumn title="Popular Services" links={serviceLinks} />
          <FooterColumn title="Vehicle Categories" links={categoryLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <section aria-labelledby="footer-contact" className="flex shrink-0 flex-col gap-3">
            <h2 id="footer-contact" className="text-pretty font-semibold">
              Contact Us
            </h2>
            <ul className="flex flex-col gap-4">
              <li>
                <a href={`mailto:${LEGAL_CONSTANTS.supportEmail}`} className={linkClassName}>
                  {LEGAL_CONSTANTS.supportEmail}
                </a>
              </li>
              <li>
                <a href={`tel:${LEGAL_CONSTANTS.supportPhone}`} className={linkClassName}>
                  {LEGAL_CONSTANTS.supportPhoneDisplay}
                </a>
              </li>
            </ul>
            <nav aria-label="Social" className="flex gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm touch-manipulation transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <img
                    src={link.src}
                    alt={link.label}
                    width={24}
                    height={24}
                    loading="lazy"
                    className="size-6"
                  />
                </a>
              ))}
            </nav>
          </section>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex max-w-[500px] flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p translate="no" className="font-brand text-[30px] leading-9 font-bold text-white">
                {LEGAL_CONSTANTS.companyName}
              </p>
              <p>
                {LEGAL_CONSTANTS.companyName} offers professional chauffeur services across Nigeria
                with a diverse fleet of luxury sedans, executive SUVs, and budget-friendly vehicles.
                Whether you need airport pickup, full-day charter, or hourly rentals, our vetted
                drivers ensure safe, comfortable, and reliable transportation.
              </p>
            </div>
            <p className="flex items-center gap-2">
              <img
                src="/footer/nigeria.svg"
                alt=""
                width={24}
                height={24}
                loading="lazy"
                aria-hidden="true"
                className="size-6"
              />
              Lagos, Nigeria
            </p>
          </div>
          {/* ponytail: badges are not links until App Store and Play URLs exist */}
          <div className="flex flex-wrap items-start gap-[17px] lg:gap-[19.107px]">
            <StoreBadge src="/footer/apple.svg" caption="Download on the" title="App Store" />
            <StoreBadge src="/footer/google-play.svg" caption="GET IT ON" title="Google Play" />
          </div>
        </div>
      </div>

      <div className="bg-[#1e2023]">
        <div className="mx-auto flex h-20 w-full max-w-[1440px] flex-col justify-center gap-[17px] px-[15px] text-xs leading-3 text-gray-300 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <p>
            ©{" "}
            <span data-visual-dynamic suppressHydrationWarning>
              {new Date().getFullYear()}
            </span>{" "}
            <span translate="no">{LEGAL_CONSTANTS.companyName}</span>. All rights reserved.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-[17px] lg:gap-6">
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
