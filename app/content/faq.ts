export interface FaqItem {
  readonly answer: string;
  readonly question: string;
}

interface FaqCategory {
  readonly id: string;
  readonly name: string;
  readonly questions: readonly FaqItem[];
}

export const FAQ_CATEGORIES: readonly FaqCategory[] = [
  {
    id: "booking",
    name: "Booking & Reservations",
    questions: [
      {
        question: "How do I book a chauffeur service?",
        answer:
          "Booking is simple: visit our website, select your pickup location, date, time, and preferred vehicle type. Complete the booking form and pay securely online. You'll receive instant confirmation via email and SMS.",
      },
      {
        question: "How far in advance should I book?",
        answer:
          "We recommend booking at least 24 hours in advance for regular trips. For airport pickups, 6 hours notice is usually sufficient. During peak periods (holidays, major events), we suggest booking 2-3 days ahead to ensure your preferred vehicle is available.",
      },
      {
        question: "Can I book for someone else?",
        answer:
          "Yes, you can book on behalf of someone else. Simply enter their details as the passenger during booking. They'll receive trip details via SMS, and the driver will contact them directly.",
      },
      {
        question: "How do I modify or cancel my booking?",
        answer:
          "You can modify or cancel your booking through your booking confirmation email or by contacting our support team. Cancellations made 24+ hours before the trip are fully refundable. Cancellations within 24 hours may incur a fee.",
      },
      {
        question: "Is there a minimum booking duration?",
        answer:
          "Yes, our minimum booking is 4 hours for day hire and 6 hours for night service. Airport pickups and drop-offs don't have a minimum duration requirement.",
      },
    ],
  },
  {
    id: "pricing",
    name: "Pricing & Payment",
    questions: [
      {
        question: "How is pricing calculated?",
        answer:
          "Pricing depends on the vehicle type, service type (day hire, airport pickup, night service), and duration. You'll see the exact price before confirming your booking. All prices include the chauffeur, fuel for standard routes, and VAT.",
      },
      {
        question: "What payment methods do you accept?",
        answer:
          "We accept all major credit/debit cards, bank transfers, and mobile payments. Corporate clients can also arrange monthly invoicing. Payment is required at the time of booking to confirm your reservation.",
      },
      {
        question: "Are there any hidden fees?",
        answer:
          "No hidden fees. The price you see at booking is what you pay. Additional charges only apply for: extended hours beyond your booking, extra stops not in the original itinerary, or waiting time exceeding 30 minutes for airport pickups.",
      },
      {
        question: "Do you offer corporate accounts?",
        answer:
          "Yes, we offer corporate accounts with benefits including monthly billing, dedicated account managers, priority booking, volume discounts, and detailed trip reports. Contact us to set up a corporate account.",
      },
      {
        question: "What's your refund policy?",
        answer:
          "Full refunds are provided for cancellations made 24+ hours before the trip. Cancellations within 24 hours receive a 50% refund. No-shows are non-refundable. Refunds are processed within 5-7 business days.",
      },
    ],
  },
  {
    id: "service",
    name: "Service & Vehicles",
    questions: [
      {
        question: "What types of vehicles are available?",
        answer:
          "We offer a range of vehicles including luxury sedans (Toyota Camry, Honda Accord), SUVs (Toyota Highlander, Lexus RX), executive vehicles (Mercedes-Benz, BMW), and premium options for special occasions. All vehicles are well-maintained and air-conditioned.",
      },
      {
        question: "Are your chauffeurs professional and vetted?",
        answer:
          "Yes, all our chauffeurs undergo thorough background checks, driving record verification, and customer service training. They're professionally dressed, punctual, and experienced in navigating Lagos traffic efficiently.",
      },
      {
        question: "What's included in the service?",
        answer:
          "Every booking includes: a professional uniformed chauffeur, a well-maintained luxury vehicle, bottled water, phone charging cables, and free WiFi (in select vehicles). Airport pickups include flight tracking and meet-and-greet service.",
      },
      {
        question: "Can I request a specific driver?",
        answer:
          "Yes, if you've had a great experience with a particular driver, you can request them for future bookings. We'll do our best to accommodate your preference based on availability.",
      },
      {
        question: "What happens if the vehicle breaks down?",
        answer:
          "In the rare event of a breakdown, we immediately dispatch a replacement vehicle at no extra cost. Our 24/7 support team monitors all trips and will proactively arrange alternatives to minimize any inconvenience.",
      },
    ],
  },
  {
    id: "airport",
    name: "Airport Transfers",
    questions: [
      {
        question: "Do you provide Lagos Airport (MMIA) pickup?",
        answer:
          "Yes, we provide 24/7 pickup and drop-off services at Murtala Muhammed International Airport (MMIA), covering both Terminal 1 (International) and Terminal 2 (Domestic/MMA2). Our drivers meet you at arrivals with a name board.",
      },
      {
        question: "How does flight tracking work?",
        answer:
          "When you provide your flight number, we automatically track your flight status. If your flight is delayed, your driver's arrival time adjusts accordingly at no extra charge. You don't need to worry about informing us of delays.",
      },
      {
        question: "Where will my driver meet me at the airport?",
        answer:
          "Your driver will wait at the arrivals hall exit with a sign displaying your name. For international arrivals, they'll be just outside customs. You'll receive the driver's phone number to coordinate if needed.",
      },
      {
        question: "Is there a waiting time fee for airport pickups?",
        answer:
          "We provide 30 minutes of free waiting time for domestic flights and 60 minutes for international flights (from the flight landing time). After that, waiting time is charged at a reasonable hourly rate.",
      },
      {
        question: "Can you help with luggage?",
        answer:
          "Absolutely. Our chauffeurs assist with loading and unloading your luggage. If you have excessive luggage or special items, please mention this when booking so we can arrange an appropriate vehicle.",
      },
    ],
  },
  {
    id: "coverage",
    name: "Service Areas",
    questions: [
      {
        question: "Which areas in Lagos do you cover?",
        answer:
          "We cover all of Lagos including Victoria Island, Ikoyi, Lekki (Phase 1 & 2), Ajah, Ikeja, Maryland, Yaba, Surulere, Lagos Island, Apapa, and Festac. Essentially, if it's in Lagos, we can get you there.",
      },
      {
        question: "Do you offer inter-state trips?",
        answer:
          "Yes, we offer inter-state trips from Lagos to cities like Ibadan, Abeokuta, Benin City, and more. Inter-state trips require advance booking and may have different pricing. Contact us for a custom quote.",
      },
      {
        question: "Can I make multiple stops during my trip?",
        answer:
          "Yes, you can add multiple stops to your itinerary. For day hire bookings, stops within your booking duration are included. Additional stops or extended time may incur extra charges, which we'll communicate upfront.",
      },
      {
        question: "Do you operate during traffic congestion hours?",
        answer:
          "Yes, we operate 24/7 including peak traffic hours. Our drivers are experienced with Lagos traffic patterns and use real-time navigation to find the best routes. We factor in traffic when estimating travel times.",
      },
    ],
  },
  {
    id: "safety",
    name: "Safety & Security",
    questions: [
      {
        question: "How do you ensure passenger safety?",
        answer:
          "Safety is our priority. All vehicles undergo regular maintenance checks, drivers are vetted and trained, trips are GPS-tracked, and our 24/7 support team monitors all journeys. You can share your live trip status with family or colleagues.",
      },
      {
        question: "Are vehicles insured?",
        answer:
          "Yes, all vehicles on our platform carry comprehensive insurance that covers passengers. In the unlikely event of an incident, you're fully protected.",
      },
      {
        question: "Can I track my ride or share my location?",
        answer:
          "Yes, you'll receive a link to track your ride in real-time. You can share this link with family, friends, or colleagues so they know your location and estimated arrival time.",
      },
      {
        question: "What COVID-19 safety measures are in place?",
        answer:
          "Our vehicles are sanitized between trips, and hand sanitizer is available. Drivers follow health guidelines and can wear masks upon request. We've also enabled contactless payment and digital receipts.",
      },
    ],
  },
];

export const FAQ_ITEMS = FAQ_CATEGORIES.flatMap((category) => category.questions);
