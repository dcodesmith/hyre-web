import type { NormalisedBookingDetails, NormalisedExtensionDetails } from "~/lib/utils";
import type {
  FlightArrivalData,
  FlightCancellationData,
  FlightDelayData,
  FlightDiversionData,
  FlightGateChangeData,
} from "~/modules/email/templates/flight-notifications";
import type {
  ReferralAttributionUserData,
  ReferralDiscountBookingData,
  ReferralRewardEarnedData,
} from "~/modules/email/templates/referral-emails";
import type { ReviewData } from "~/modules/email/templates/review-emails";

/** Shared fixtures for React Email `email dev` previews and tests. */
export const sampleBooking: NormalisedBookingDetails = {
  bookingReference: "TRP-8F2K9Q",
  id: "clsamplebooking001",
  customerName: "Alex Johnson",
  ownerName: "Fleet Lagos Ltd",
  chauffeurName: "Sam Driver",
  chauffeurPhoneNumber: "+234 800 000 0000",
  carName: "Mercedes-Benz S-Class (2024)",
  pickupLocation: "Murtala Muhammed International Airport, Lagos",
  returnLocation: "Eko Hotels & Suites, Victoria Island",
  startDate: "Mon, Apr 21, 2026 · 2:00 PM",
  endDate: "Wed, Apr 23, 2026 · 10:00 AM",
  customerPhoneNumber: "+234 801 234 5678",
  totalAmount: "₦450,000.00",
  title: "confirmed",
  status: "confirmed",
  cancellationReason: "",
};

export const sampleBookingCancelled: NormalisedBookingDetails = {
  ...sampleBooking,
  title: "cancelled",
  status: "cancelled",
  cancellationReason: "Customer requested cancellation",
};

export const sampleBookingStatusUpdate: NormalisedBookingDetails = {
  ...sampleBooking,
  title: "started",
  status: "active",
};

export const sampleExtension: NormalisedExtensionDetails = {
  customerName: "Alex Johnson",
  customerPhoneNumber: "+234 801 234 5678",
  carName: "Mercedes-Benz S-Class (2024)",
  legDate: "Mon, Apr 21, 2026",
  extensionHours: 2,
  from: "4:00 PM",
  to: "6:00 PM",
};

export const sampleReviewData: ReviewData = {
  customerName: "Alex Johnson",
  bookingReference: "TRP-8F2K9Q",
  carName: "Mercedes-Benz S-Class (2024)",
  overallRating: 4.5,
  carRating: 5,
  chauffeurRating: 4,
  serviceRating: 4.5,
  comment: "Smooth pickup and excellent vehicle condition.",
  reviewDate: "Tue, Apr 22, 2026",
};

export const sampleReferralAttribution: ReferralAttributionUserData = {
  name: "Alex Johnson",
  referralCode: "ALEX2026",
  referrerName: "Jamie Referrer",
  discountAmount: 15000,
  phoneNumber: "+234 801 234 5678",
};

export const sampleReferralDiscountBooking: ReferralDiscountBookingData = {
  customerName: "Alex Johnson",
  bookingReference: "TRP-8F2K9Q",
  carName: "Mercedes-Benz S-Class (2024)",
  discountAmount: 15000,
  originalAmount: 450000,
  finalAmount: 435000,
  referrerName: "Jamie Referrer",
  phoneNumber: "+234 801 234 5678",
};

export const sampleReferralReward: ReferralRewardEarnedData = {
  referrerName: "Jamie Referrer",
  referredUserName: "Alex Johnson",
  rewardAmount: 5000,
  bookingReference: "TRP-8F2K9Q",
  totalReferrals: 3,
  totalRewardsEarned: 15000,
  phoneNumber: "+234 800 111 2222",
};

export const sampleCarDetails = {
  make: "Mercedes-Benz",
  model: "S-Class",
  year: 2024,
  registration: "ABC-123LA",
};

export const sampleFlightArrival: FlightArrivalData = {
  recipientName: "Sam Owner",
  recipientRole: "owner",
  flightNumber: "BA 74",
  flightDate: "2026-04-21",
  originCode: "LOS",
  destinationCode: "LHR",
  bookingReference: "TRP-8F2K9Q",
  carName: "Mercedes-Benz S-Class (2024)",
  customerName: "Alex Johnson",
  estimatedArrival: "3:45 PM",
  actualArrival: "3:52 PM",
  arrivalGate: "A3",
};

export const sampleFlightArrivalDriver: FlightArrivalData = {
  ...sampleFlightArrival,
  recipientName: "Pat Driver",
  recipientRole: "driver",
};

export const sampleFlightDelay: FlightDelayData = {
  recipientName: "Sam Owner",
  recipientRole: "owner",
  flightNumber: "BA 74",
  flightDate: "2026-04-21",
  originCode: "LOS",
  destinationCode: "LHR",
  bookingReference: "TRP-8F2K9Q",
  carName: "Mercedes-Benz S-Class (2024)",
  customerName: "Alex Johnson",
  delayMinutes: 90,
  estimatedArrival: "5:15 PM",
  previousEstimatedArrival: "3:45 PM",
};

export const sampleFlightCancellationCustomer: FlightCancellationData = {
  recipientName: "Alex Johnson",
  recipientRole: "customer",
  flightNumber: "BA 74",
  originCode: "LOS",
  destinationCode: "LHR",
  cancellationReason: "Operational reasons",
  bookingReference: "TRP-8F2K9Q",
  carName: "Mercedes-Benz S-Class (2024)",
  customerName: "Alex Johnson",
};

export const sampleFlightCancellationOwner: FlightCancellationData = {
  recipientName: "Sam Owner",
  recipientRole: "owner",
  flightNumber: "BA 74",
  originCode: "LOS",
  destinationCode: "LHR",
  cancellationReason: "Operational reasons",
  bookingReference: "TRP-8F2K9Q",
  carName: "Mercedes-Benz S-Class (2024)",
  customerName: "Alex Johnson",
};

export const sampleFlightCancellationDriver: FlightCancellationData = {
  ...sampleFlightCancellationOwner,
  recipientName: "Pat Driver",
  recipientRole: "driver",
};

export const sampleFlightDiversionCustomer: FlightDiversionData = {
  recipientName: "Alex Johnson",
  recipientRole: "customer",
  flightNumber: "BA 74",
  originCode: "LOS",
  destinationCode: "LHR",
  newDestinationCode: "ABV",
  newDestinationName: "Abuja",
  bookingReference: "TRP-8F2K9Q",
  carName: "Mercedes-Benz S-Class (2024)",
  customerName: "Alex Johnson",
};

export const sampleFlightDiversionOwner: FlightDiversionData = {
  recipientName: "Sam Owner",
  recipientRole: "owner",
  flightNumber: "BA 74",
  originCode: "LOS",
  destinationCode: "LHR",
  newDestinationCode: "ABV",
  newDestinationName: "Abuja",
  bookingReference: "TRP-8F2K9Q",
  carName: "Mercedes-Benz S-Class (2024)",
  customerName: "Alex Johnson",
};

export const sampleFlightDelayDriver: FlightDelayData = {
  ...sampleFlightDelay,
  recipientName: "Pat Driver",
  recipientRole: "driver",
};

export const sampleFlightGateChange: FlightGateChangeData = {
  recipientName: "Sam Owner",
  recipientRole: "owner",
  flightNumber: "BA 74",
  flightDate: "2026-04-21",
  originCode: "LOS",
  destinationCode: "LHR",
  bookingReference: "TRP-8F2K9Q",
  carName: "Mercedes-Benz S-Class (2024)",
  customerName: "Alex Johnson",
  oldGate: "A2",
  newGate: "A3",
};

export const sampleFlightGateChangeDriver: FlightGateChangeData = {
  ...sampleFlightGateChange,
  recipientName: "Pat Driver",
  recipientRole: "driver",
};
