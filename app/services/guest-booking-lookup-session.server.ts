import { commitSession, getSession } from "~/modules/auth/session.server";

const GUEST_BOOKING_LOOKUP_EMAIL_KEY = "bookings:guestLookup:email";
const GUEST_BOOKING_LOOKUP_REFERENCE_KEY = "bookings:guestLookup:bookingReference";
const GUEST_BOOKING_LOOKUP_ID_KEY = "bookings:guestLookup:bookingId";

export type GuestBookingLookupSession = {
  email: string;
  bookingReference: string;
  bookingId: string;
};

export function normalizeGuestLookupEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeGuestLookupBookingReference(bookingReference: string): string {
  return bookingReference.trim().toUpperCase();
}

export async function getGuestBookingLookup(
  request: Request,
): Promise<GuestBookingLookupSession | null> {
  const session = await getSession(request.headers.get("Cookie"));
  const email = session.get(GUEST_BOOKING_LOOKUP_EMAIL_KEY);
  const bookingReference = session.get(GUEST_BOOKING_LOOKUP_REFERENCE_KEY);
  const bookingId = session.get(GUEST_BOOKING_LOOKUP_ID_KEY);

  if (
    typeof email !== "string" ||
    typeof bookingReference !== "string" ||
    typeof bookingId !== "string"
  ) {
    return null;
  }

  const normalizedEmail = normalizeGuestLookupEmail(email);
  const normalizedBookingReference = normalizeGuestLookupBookingReference(bookingReference);
  const normalizedBookingId = bookingId.trim();

  if (!normalizedEmail || !normalizedBookingReference || !normalizedBookingId) {
    return null;
  }

  return {
    email: normalizedEmail,
    bookingReference: normalizedBookingReference,
    bookingId: normalizedBookingId,
  };
}

export async function setGuestBookingLookup(
  request: Request,
  lookup: GuestBookingLookupSession,
): Promise<string> {
  const session = await getSession(request.headers.get("Cookie"));
  session.set(GUEST_BOOKING_LOOKUP_EMAIL_KEY, normalizeGuestLookupEmail(lookup.email));
  session.set(
    GUEST_BOOKING_LOOKUP_REFERENCE_KEY,
    normalizeGuestLookupBookingReference(lookup.bookingReference),
  );
  session.set(GUEST_BOOKING_LOOKUP_ID_KEY, lookup.bookingId.trim());
  return commitSession(session);
}

export async function clearGuestBookingLookup(request: Request): Promise<string> {
  const session = await getSession(request.headers.get("Cookie"));
  session.unset(GUEST_BOOKING_LOOKUP_EMAIL_KEY);
  session.unset(GUEST_BOOKING_LOOKUP_REFERENCE_KEY);
  session.unset(GUEST_BOOKING_LOOKUP_ID_KEY);
  return commitSession(session);
}

function extractGuestEmailFromGuestUser(value: unknown): string | null {
  if (value && typeof value === "object") {
    const maybeValue = value as { email?: unknown };
    if (typeof maybeValue.email === "string") {
      const email = normalizeGuestLookupEmail(maybeValue.email);
      return email || null;
    }
  }

  return null;
}

export function guestBookingLookupMatches(
  lookup: GuestBookingLookupSession,
  booking: {
    id: string;
    bookingReference: string;
    guestUser: unknown;
  },
): boolean {
  const bookingGuestEmail = extractGuestEmailFromGuestUser(booking.guestUser);
  if (!bookingGuestEmail) {
    return false;
  }

  return (
    booking.id === lookup.bookingId &&
    normalizeGuestLookupBookingReference(booking.bookingReference) === lookup.bookingReference &&
    bookingGuestEmail === lookup.email
  );
}
