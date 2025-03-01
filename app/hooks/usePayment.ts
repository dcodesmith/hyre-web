import { Car, User } from "@prisma/client";
import { useNavigate, useSubmit } from "@remix-run/react";
import { closePaymentModal, useFlutterwave } from "flutterwave-react-v3";
import { useCallback } from "react";

type FlutterwaveConfig = {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  payment_options: string;
  customer: {
    email: string;
    phone_number: string;
    name: string;
  };
  customizations: {
    title: string;
    description: string;
    logo: string;
  };
};

const config: Omit<FlutterwaveConfig, "amount" | "customer"> = {
  public_key: "FLWPUBK_TEST-02b9b5fc6406bd4a41c3ff141cc45e93-X",
  tx_ref: "txref-DI0NzMx13",
  currency: "NGN",
  payment_options: "card,mobilemoney,ussd",
  customizations: {
    title: "Booking Payment",
    description: "Payment for Booking",
    logo: "https://picsum.photos/seed/car-rental/800/600",
  },
};

export function useBookingPayment({
  car,
  totalCost,
  customer,
  searchParams,
  user,
}: {
  car: Car;
  totalCost: number;
  customer: FlutterwaveConfig["customer"];
  searchParams: string;
  user: User;
}) {
  const submit = useSubmit();
  const navigate = useNavigate();

  const handlePayment = useFlutterwave({
    ...config,
    amount: process.env.NODE_ENV === "development" ? 3000 : totalCost,
    customer,
    customizations: config.customizations,
  });

  return useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const formElement = event.currentTarget;
      const formData = new FormData(formElement);
      const isGuestBooking = formElement.getAttribute("data-booking-type") === "guest";

      formData.set("bookingType", isGuestBooking ? "guest" : "auth");

      if (!isGuestBooking && !user) {
        const redirectTo = `/cars/${car.id}${searchParams ? `?${searchParams}` : ""}`;
        return navigate(`/auth?redirectTo=${encodeURIComponent(redirectTo)}`);
      }

      handlePayment({
        callback: ({ transaction_id: transactionId, status }) => {
          formData.set("paymentId", String(transactionId));
          formData.set("status", status);
          submit(formData, {
            method: "POST",
            action: `/bookings?${searchParams}`,
          });
          setTimeout(() => closePaymentModal(), 1500);
        },
        onClose: () => closePaymentModal(),
      });
    },
    [handlePayment, searchParams, submit, navigate, user, car],
  );
}
