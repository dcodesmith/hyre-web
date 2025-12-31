import { CarApprovalStatus, Status } from "@prisma/client";
import type { MetaFunction } from "@remix-run/node";
import { data } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import {
  Plane,
  Building2,
  Calendar,
  Moon,
  Heart,
  MapPin,
  Clock,
  Shield,
  Star,
  ChevronRight,
  Phone,
} from "lucide-react";

import { prisma } from "~/modules/db/db.server";
import { env } from "~/utils/server/env.server";
import { CarCard } from "~/components/CarCard";
import { CarouselSection } from "~/components/CarouselSection";
import {
  LocalBusinessSchema,
  ServiceSchema,
  FAQSchema,
  BreadcrumbSchema,
} from "~/components/seo/StructuredData";
import { Button } from "~/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import type { SerializedCar } from "~/types";
import { getLocationKeywords, generateMetaTags, getBaseUrl } from "~/utils/seo";

// Lagos-specific FAQ data
const lagosFaqData = {
  questions: [
    {
      question: "How much does a chauffeur service cost in Lagos?",
      answer:
        "Our Lagos chauffeur service starts from ₦25,000 per day for standard vehicles. Airport transfers from Murtala Muhammed International Airport start from ₦15,000. Prices vary based on vehicle type, duration, and distance. Get an instant quote on our booking page.",
    },
    {
      question: "Do you provide airport pickup at Lagos Airport (MMIA)?",
      answer:
        "Yes, we provide 24/7 airport pickup and drop-off services at Murtala Muhammed International Airport (MMIA), covering both Terminal 1 (International) and Terminal 2 (Domestic). Our drivers track your flight and wait for you at arrivals.",
    },
    {
      question: "Which areas in Lagos do you cover?",
      answer:
        "We cover all of Lagos including Victoria Island, Ikoyi, Lekki (Phase 1 & 2), Ajah, Ikeja, Maryland, Yaba, Surulere, Apapa, and Lagos Island. We also offer inter-state trips to Ibadan, Abeokuta, and other nearby cities.",
    },
    {
      question: "How far in advance should I book in Lagos?",
      answer:
        "For regular bookings, we recommend booking at least 24 hours in advance. For airport pickups, 6 hours notice is usually sufficient. During peak periods (holidays, events), book 2-3 days ahead to ensure vehicle availability.",
    },
    {
      question: "Are your Lagos chauffeurs trained and vetted?",
      answer:
        "Yes, all our Lagos-based chauffeurs undergo thorough background checks, defensive driving training, and customer service training. They have extensive knowledge of Lagos roads and traffic patterns to ensure timely arrivals.",
    },
    {
      question: "Do you offer corporate accounts for Lagos businesses?",
      answer:
        "Yes, we offer corporate accounts with monthly billing, dedicated account managers, and priority booking for Lagos-based businesses. Contact us to set up a corporate account with volume discounts.",
    },
  ],
};

// Lagos services data
const lagosServices = [
  {
    icon: Plane,
    title: "Airport Transfers",
    description: "MMIA Terminal 1 & 2 pickup/drop-off with flight tracking",
    href: "/search?bookingType=AIRPORT_PICKUP",
  },
  {
    icon: Building2,
    title: "Corporate Travel",
    description: "Executive transport for meetings, conferences & client visits",
    href: "/search?serviceTier=EXECUTIVE",
  },
  {
    icon: Calendar,
    title: "Day Hire",
    description: "Full-day chauffeur service for business or leisure",
    href: "/search?bookingType=DAY",
  },
  {
    icon: Moon,
    title: "Night Service",
    description: "Safe late-night transport for events and nightlife",
    href: "/search?bookingType=NIGHT",
  },
  {
    icon: Heart,
    title: "Weddings & Events",
    description: "Luxury vehicles for your special occasions",
    href: "/search?serviceTier=LUXURY",
  },
  {
    icon: MapPin,
    title: "Inter-State Trips",
    description: "Lagos to Ibadan, Abeokuta & beyond",
    href: "/search",
  },
];

// Popular Lagos routes
const popularRoutes = [
  { from: "Lagos Airport (MMIA)", to: "Victoria Island", duration: "45-90 min" },
  { from: "Lagos Airport (MMIA)", to: "Lekki Phase 1", duration: "60-120 min" },
  { from: "Victoria Island", to: "Ikeja", duration: "30-60 min" },
  { from: "Lekki", to: "Lagos Island", duration: "45-90 min" },
  { from: "Lagos", to: "Ibadan", duration: "2-3 hours" },
];

// Lagos areas served
const areasServed = [
  "Victoria Island",
  "Ikoyi",
  "Lekki Phase 1",
  "Lekki Phase 2",
  "Ajah",
  "Ikeja",
  "Maryland",
  "Yaba",
  "Surulere",
  "Lagos Island",
  "Apapa",
  "Festac",
];

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const baseUrl = getBaseUrl(data?.ENV?.DOMAIN);

  const title = "Chauffeur Service Lagos - Premium Car Hire & Airport Transfers | Tripdly";
  const description =
    "Book professional chauffeur service in Lagos. Airport transfers from MMIA, corporate travel, day hire & night service. Luxury vehicles, vetted drivers. Victoria Island, Lekki, Ikeja & all Lagos areas. Book online instantly.";

  const keywords = [
    ...getLocationKeywords("Lagos"),
    "Lagos airport transfer",
    "MMIA pickup",
    "Victoria Island car hire",
    "Lekki chauffeur",
    "Ikeja airport transfer",
    "Lagos corporate car",
    "Lagos wedding car",
    "Lagos to Ibadan",
  ];

  return generateMetaTags({
    title,
    description,
    url: `${baseUrl}/chauffeur-service-lagos`,
    image: `${baseUrl}/og-image.jpg`,
    keywords,
    canonical: `${baseUrl}/chauffeur-service-lagos`,
    geoRegion: "NG-LA",
    geoPlacename: "Lagos",
    geoPosition: "6.5244;3.3792",
  });
};

export async function loader() {
  // Fetch available cars for Lagos
  const cars = await prisma.car.findMany({
    where: {
      status: { in: [Status.AVAILABLE, Status.BOOKED] },
      approvalStatus: CarApprovalStatus.APPROVED,
      owner: { fleetOwnerStatus: "APPROVED", hasOnboarded: true },
    },
    include: {
      owner: { select: { username: true, name: true } },
      images: { select: { url: true }, orderBy: { createdAt: "asc" }, take: 4 },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 12, // Show top 12 cars
  });

  return data(
    {
      cars: cars as unknown as SerializedCar[],
      ENV: { DOMAIN: env.DOMAIN },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=600, stale-while-revalidate=1800",
      },
    },
  );
}

export default function ChauffeurServiceLagos() {
  const { cars, ENV } = useLoaderData<typeof loader>();

  const baseUrl = getBaseUrl(ENV?.DOMAIN);

  return (
    <div className="w-full">
      {/* Structured Data */}
      <LocalBusinessSchema
        data={{
          name: "Tripdly Lagos",
          url: `${baseUrl}/chauffeur-service-lagos`,
          logo: `${baseUrl}/logo.svg`,
          description:
            "Premium chauffeur service in Lagos, Nigeria. Airport transfers, corporate travel, and luxury car hire with professional drivers.",
          email: "lagos@tripdly.com",
          phone: "+234 800 000 0000",
          priceRange: "₦₦₦",
          address: {
            streetAddress: "Victoria Island",
            city: "Lagos",
            state: "Lagos",
            country: "NG",
            postalCode: "101233",
          },
          geo: {
            latitude: 6.4281,
            longitude: 3.4219,
          },
          areaServed: areasServed,
        }}
      />
      <ServiceSchema
        data={{
          name: "Lagos Chauffeur Service",
          description:
            "Professional chauffeur and car hire service in Lagos. Airport transfers from MMIA, corporate travel, day hire, and special events.",
          provider: "Tripdly",
          providerUrl: baseUrl,
          serviceType: "Chauffeur Service",
          areaServed: ["Lagos", "Victoria Island", "Lekki", "Ikeja", "Ikoyi"],
          priceRange: "₦₦₦",
          image: `${baseUrl}/og-image.jpg`,
        }}
      />
      <FAQSchema data={lagosFaqData} />
      <BreadcrumbSchema
        data={{
          items: [
            { name: "Home", url: baseUrl },
            { name: "Chauffeur Service Lagos", url: `${baseUrl}/chauffeur-service-lagos` },
          ],
        }}
      />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="absolute inset-0 bg-[url('/images/hero.webp')] bg-cover bg-center opacity-20" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm text-gray-300 mb-4">
              <MapPin className="h-4 w-4" />
              <span>Lagos, Nigeria</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
              Premium Chauffeur Service in Lagos
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-8 leading-relaxed">
              Professional drivers, luxury vehicles, and seamless booking for airport transfers,
              corporate travel, and special occasions across Lagos.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="bg-white text-gray-900 hover:bg-gray-100">
                <Link to="/search">
                  Book Now
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10 hover:text-white bg-transparent"
              >
                <Link to="/search?bookingType=AIRPORT_PICKUP">Airport Pickup</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-wrap justify-center gap-8 md:gap-12 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              <span>Vetted Drivers</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <span>24/7 Service</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <span>Top-Rated</span>
            </div>
            <div className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-purple-600" />
              <span>Flight Tracking</span>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="bg-gray-50 py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Our Services in Lagos</h2>
          <p className="text-gray-600 text-center mb-10 max-w-2xl mx-auto">
            From airport transfers to corporate travel, we provide comprehensive chauffeur services
            across Lagos and beyond.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lagosServices.map((service) => (
              <Link
                key={service.title}
                to={service.href}
                className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all group focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
              >
                <service.icon className="h-10 w-10 text-gray-700 mb-4 group-hover:text-gray-900 transition-colors" />
                <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
                <p className="text-gray-600 text-sm">{service.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Routes */}
      <section className="bg-white py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Popular Lagos Routes</h2>
          <p className="text-gray-600 text-center mb-10 max-w-2xl mx-auto">
            Frequently requested routes with estimated travel times (varies with traffic).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularRoutes.map((route) => (
              <div
                key={`${route.from}-${route.to}`}
                className="border rounded-lg p-4 hover:border-gray-400 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">
                      {route.from} → {route.to}
                    </p>
                    <p className="text-sm text-gray-500">{route.duration}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Available Vehicles */}
      {cars.length > 0 && (
        <section className="bg-gray-50 py-12 md:py-16">
          <CarouselSection title="Available Vehicles in Lagos" href="/search">
            {cars.map((car, index) => (
              <CarCard
                key={car.id}
                car={car}
                priority={index < 4}
                price={car.dayRate}
                showTotal={false}
              />
            ))}
          </CarouselSection>
        </section>
      )}

      {/* Areas We Serve */}
      <section className="bg-white py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
            Areas We Serve in Lagos
          </h2>
          <p className="text-gray-600 text-center mb-10 max-w-2xl mx-auto">
            We provide chauffeur services across all major areas in Lagos State.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {areasServed.map((area) => (
              <span
                key={area}
                className="px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-700"
              >
                {area}
              </span>
            ))}
          </div>
          <p className="text-center text-gray-500 text-sm mt-6">
            Plus inter-state service to Ibadan, Abeokuta, and other nearby cities
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gray-50 py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
            Frequently Asked Questions
          </h2>
          <Accordion type="multiple" className="bg-white rounded-lg border shadow-sm">
            {lagosFaqData.questions.map((faq, index) => (
              <AccordionItem
                key={faq.question}
                value={`faq-${index}`}
                className="border-b border-gray-200 last:border-0 px-6"
              >
                <AccordionTrigger className="text-left hover:no-underline py-5">
                  <span className="font-semibold text-lg text-gray-900 pr-4">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-gray-600 leading-relaxed pb-2">{faq.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="text-center mt-8">
            <Link
              to="/faq"
              className="text-gray-900 font-medium hover:underline inline-flex items-center gap-1"
            >
              View all FAQs
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-900 text-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Book Your Lagos Chauffeur?
          </h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            Experience premium transportation in Lagos with professional drivers and luxury
            vehicles. Book online in minutes.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild size="lg" className="bg-white text-gray-900 hover:bg-gray-100">
              <Link to="/search">Book Online</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10"
            >
              <a href="tel:+2348000000000">
                <Phone className="mr-2 h-4 w-4" />
                Call Us
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
