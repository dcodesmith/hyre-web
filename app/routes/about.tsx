import { ArrowRight, Building2, CheckCircle2, Clock, ShieldCheck, UserCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { buildPageMetadata, SITE_ORIGIN } from "~/seo/metadata";
import { BreadcrumbStructuredData } from "~/seo/structured-data";

export const meta = () =>
  buildPageMetadata({
    title: "About Us - Connecting Fleet Owners with Customers | Tripdly",
    description:
      "Learn about Tripdly, Nigeria's premier platform connecting fleet owners and owner drivers with customers seeking premium chauffeur services.",
    path: "/about",
  });

export { staticPageHeaders as headers } from "~/seo/metadata";

export default function AboutPage() {
  return (
    <div className="w-full">
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: SITE_ORIGIN },
          { name: "About Us", url: `${SITE_ORIGIN}/about` },
        ]}
      />

      <div className="flex flex-col gap-20">
        <section className="flex justify-center py-8">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <h1 className="mb-6 text-4xl font-bold md:text-5xl lg:text-6xl">About Tripdly</h1>
            <p className="mb-8 text-xl leading-relaxed text-gray-600 md:text-2xl">
              Connecting fleet owners and owner drivers with customers seeking premium chauffeur
              services across Nigeria.
            </p>
            <p className="mx-auto max-w-3xl text-lg leading-relaxed text-gray-700">
              We&apos;re building Nigeria&apos;s most trusted platform for luxury car hire, making
              it easier for fleet owners to grow their business and for customers to access
              professional transportation services.
            </p>
          </div>
        </section>

        <section className="flex justify-center py-8">
          <div className="mx-auto max-w-4xl px-4">
            <div className="mb-8 text-center">
              <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">Our Story</h2>
              <div className="mx-auto h-1 w-20 bg-gray-900" />
            </div>

            <div className="max-w-none">
              <p className="mb-6 text-lg leading-relaxed text-gray-700">
                Tripdly was born from a simple observation: Nigeria has thousands of quality
                vehicles sitting idle, while customers struggle to find reliable transportation.
                Fleet owners needed better ways to reach customers. Independent drivers wanted to
                earn from their vehicles without the hassle of traditional rental agencies.
              </p>
              <p className="mb-6 text-lg leading-relaxed text-gray-700">
                We built Tripdly to solve these problems. By creating a trusted marketplace,
                we&apos;re helping fleet owners scale their businesses, enabling owner drivers to
                generate income, and giving customers access to verified, affordable transportation.
              </p>
              <p className="text-lg leading-relaxed text-gray-700">
                Today, we&apos;re proud to connect hundreds of vehicles with thousands of customers
                across Nigeria. But we&apos;re just getting started.
              </p>
            </div>
          </div>
        </section>

        <section className="flex justify-center py-8">
          <div className="mx-auto max-w-4xl px-4">
            <div className="text-center">
              <h2 className="mb-6 text-3xl font-bold md:text-4xl">Our Mission</h2>
              <p className="mb-4 text-lg leading-relaxed text-gray-700">
                To transform transportation in Nigeria by creating a seamless marketplace that
                connects fleet owners and owner drivers with customers who value quality, safety,
                and professionalism.
              </p>
              <p className="mb-8 text-lg leading-relaxed text-gray-700">
                We believe that everyone deserves access to reliable, comfortable, and safe
                transportation. By empowering fleet owners with technology and connecting them with
                customers, we&apos;re building a sustainable ecosystem that benefits everyone.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button asChild className="rounded-full">
                  <Link to="/fleet-owner">
                    Become a Fleet Owner
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/search">Book a Ride</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="flex justify-center py-8">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid items-start gap-8 md:grid-cols-2 md:gap-20">
              <div className="space-y-6">
                <h2 className="text-3xl font-bold md:text-4xl">A Platform Built for Everyone</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  Whether you&apos;re a fleet owner managing multiple vehicles or an owner driver
                  with a single car, our platform is designed to help you succeed. We provide the
                  tools, technology, and support you need to grow your business.
                </p>
                <div className="space-y-5 pt-2">
                  <PlatformAudience
                    title="Fleet Owners"
                    description="Manage multiple vehicles, assign chauffeurs, track bookings, and grow your fleet business with our comprehensive dashboard."
                  />
                  <PlatformAudience
                    title="Owner Drivers"
                    description="List your car, drive it yourself, and earn income. Perfect for individuals looking to monetize their vehicle."
                  />
                  <PlatformAudience
                    title="Customers"
                    description="Browse, book, and enjoy premium chauffeur services with transparent pricing, real-time tracking, and 24/7 support."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 md:gap-5">
                <FeatureCard
                  icon={<Building2 aria-hidden="true" className="mb-3 size-8 text-gray-900" />}
                  title="Fleet Management"
                  description="Complete dashboard for managing vehicles, bookings, and chauffeurs."
                />
                <FeatureCard
                  icon={<UserCheck aria-hidden="true" className="mb-3 size-8 text-gray-900" />}
                  title="Driver Vetting"
                  description="Comprehensive background checks and verification for all chauffeurs."
                />
                <FeatureCard
                  icon={<ShieldCheck aria-hidden="true" className="mb-3 size-8 text-gray-900" />}
                  title="Secure Payments"
                  description="Safe, secure payment processing with timely payouts for fleet owners."
                />
                <FeatureCard
                  icon={<Clock aria-hidden="true" className="mb-3 size-8 text-gray-900" />}
                  title="24/7 Support"
                  description="Round-the-clock customer support for both customers and fleet owners."
                />
              </div>
            </div>
          </div>
        </section>

        <section className="flex justify-center py-8">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <h2 className="mb-6 text-3xl font-bold md:text-4xl">Ready to Get Started?</h2>
            <p className="mb-8 text-xl leading-relaxed text-gray-600">
              Whether you&apos;re looking to book a ride or list your vehicle, we&apos;re here to
              help you every step of the way.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" variant="secondary" className="rounded-full">
                <Link to="/search">
                  Book a Ride
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/fleet-owner">
                  Become a Fleet Owner
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

interface PlatformAudienceProps {
  readonly description: string;
  readonly title: string;
}

interface FeatureCardProps {
  readonly description: string;
  readonly icon: ReactNode;
  readonly title: string;
}

function PlatformAudience({ title, description }: PlatformAudienceProps) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-green-600" />
      <div>
        <h3 className="mb-1.5 font-semibold text-gray-900">{title}</h3>
        <p className="leading-relaxed text-gray-600">{description}</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        {icon}
        <CardTitle className="mb-2 text-lg">{title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
