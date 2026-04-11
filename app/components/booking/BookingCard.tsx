import { useBookingCard } from "~/hooks/useBookingCard";
import { BookingCardLayout } from "./BookingCardLayout";
import type { BookingCardProps } from "./booking-card.types";

export type { BookingCardProps } from "./booking-card.types";

export default function BookingCard(props: BookingCardProps) {
  const vm = useBookingCard(props);
  return <BookingCardLayout {...vm} />;
}
