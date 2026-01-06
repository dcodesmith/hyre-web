import type { MetaFunction } from "@remix-run/node";
import { data } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ShieldCheck, Clock, CheckCircle2, ArrowRight, Building2, UserCheck } from "lucide-react";
import { BreadcrumbSchema } from "~/components/seo/StructuredData";
import { Button } from "~/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { env } from "~/utils/server/env.server";
import { getBaseUrl, generateMetaTags } from "~/utils/seo";

export async function loader() {
  return data({
    ENV: {
      DOMAIN: env.DOMAIN,
    },
  });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const baseUrl = getBaseUrl(data?.ENV?.DOMAIN);

  const title = "About Us - Connecting Fleet Owners with Customers | Tripdly";
  const description =
    "Learn about Tripdly, Nigeria's premier platform connecting fleet owners and owner drivers with customers seeking premium chauffeur services. Discover our mission, values, and how we're transforming transportation.";

  return generateMetaTags({
    title,
    description,
    url: `${baseUrl}/about`,
    canonical: `${baseUrl}/about`,
  });
};

export default function AboutPage() {
  const { ENV } = useLoaderData<typeof loader>();
  const baseUrl = getBaseUrl(ENV?.DOMAIN);

  return (
    <div className="w-full">
      {/* Structured Data */}
      <BreadcrumbSchema
        data={{
          items: [
            { name: "Home", url: baseUrl },
            { name: "About Us", url: `${baseUrl}/about` },
          ],
        }}
      />

      <div className="flex flex-col gap-20">
        {/* Hero Section */}
        <section className="flex justify-center py-8">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">About Tripdly</h1>
            <p className="text-xl md:text-2xl text-gray-600 leading-relaxed mb-8">
              Connecting fleet owners and owner drivers with customers seeking premium chauffeur
              services across Nigeria.
            </p>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto leading-relaxed">
              We're building Nigeria's most trusted platform for luxury car hire, making it easier
              for fleet owners to grow their business and for customers to access professional
              transportation services.
            </p>
          </div>
        </section>

        {/* Our Story */}
        <section className="flex justify-center py-8">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Our Story</h2>
              <div className="w-20 h-1 bg-gray-900 mx-auto" />
            </div>

            <div className="prose prose-lg max-w-none">
              <p className="text-gray-700 leading-relaxed mb-6 text-lg">
                Tripdly was born from a simple observation: Nigeria has thousands of quality
                vehicles sitting idle, while customers struggle to find reliable transportation.
                Fleet owners needed better ways to reach customers. Independent drivers wanted to
                earn from their vehicles without the hassle of traditional rental agencies.
              </p>

              <p className="text-gray-700 leading-relaxed mb-6 text-lg">
                We built Tripdly to solve these problems. By creating a trusted marketplace, we're
                helping fleet owners scale their businesses, enabling owner drivers to generate
                income, and giving customers access to verified, affordable transportation.
              </p>

              <p className="text-gray-700 leading-relaxed text-lg">
                Today, we're proud to connect hundreds of vehicles with thousands of customers
                across Nigeria. But we're just getting started.
              </p>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="flex justify-center py-8">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Our Mission</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                To transform transportation in Nigeria by creating a seamless marketplace that
                connects fleet owners and owner drivers with customers who value quality, safety,
                and professionalism.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-8">
                We believe that everyone deserves access to reliable, comfortable, and safe
                transportation. By empowering fleet owners with technology and connecting them with
                customers, we're building a sustainable ecosystem that benefits everyone.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link to="/fleet-owner">
                  <Button className="rounded-full">
                    Become a Fleet Owner
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/search">
                  <Button variant="outline" className="rounded-full">
                    Book a Ride
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Features */}
        <section className="flex justify-center py-8">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-8 md:gap-20 items-start">
              <div className="space-y-6">
                <h2 className="text-3xl md:text-4xl font-bold">A Platform Built for Everyone</h2>
                <p className="text-lg text-gray-700 leading-relaxed">
                  Whether you're a fleet owner managing multiple vehicles or an owner driver with a
                  single car, our platform is designed to help you succeed. We provide the tools,
                  technology, and support you need to grow your business.
                </p>
                <div className="space-y-5 pt-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1.5">Fleet Owners</h3>
                      <p className="text-gray-600 leading-relaxed">
                        Manage multiple vehicles, assign chauffeurs, track bookings, and grow your
                        fleet business with our comprehensive dashboard.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1.5">Owner Drivers</h3>
                      <p className="text-gray-600 leading-relaxed">
                        List your car, drive it yourself, and earn income. Perfect for individuals
                        looking to monetize their vehicle.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1.5">Customers</h3>
                      <p className="text-gray-600 leading-relaxed">
                        Browse, book, and enjoy premium chauffeur services with transparent pricing,
                        real-time tracking, and 24/7 support.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:gap-5">
                <Card className="h-full">
                  <CardHeader className="pb-4">
                    <Building2 className="h-8 w-8 text-gray-900 mb-3" />
                    <CardTitle className="text-lg mb-2">Fleet Management</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Complete dashboard for managing vehicles, bookings, and chauffeurs.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="h-full">
                  <CardHeader className="pb-4">
                    <UserCheck className="h-8 w-8 text-gray-900 mb-3" />
                    <CardTitle className="text-lg mb-2">Driver Vetting</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Comprehensive background checks and verification for all chauffeurs.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="h-full">
                  <CardHeader className="pb-4">
                    <ShieldCheck className="h-8 w-8 text-gray-900 mb-3" />
                    <CardTitle className="text-lg mb-2">Secure Payments</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Safe, secure payment processing with timely payouts for fleet owners.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="h-full">
                  <CardHeader className="pb-4">
                    <Clock className="h-8 w-8 text-gray-900 mb-3" />
                    <CardTitle className="text-lg mb-2">24/7 Support</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Round-the-clock customer support for both customers and fleet owners.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="flex justify-center py-8">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Whether you're looking to book a ride or list your vehicle, we're here to help you
              every step of the way.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/search">
                <Button size="lg" variant="secondary" className="rounded-full">
                  Book a Ride
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/fleet-owner">
                <Button size="lg" variant="outline" className="rounded-full">
                  Become a Fleet Owner
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
