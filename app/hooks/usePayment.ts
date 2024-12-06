// "use client";

import { useFlutterwave } from "flutterwave-react-v3";
import { FlutterwaveConfig } from "flutterwave-react-v3/dist/types";

const config = {
  public_key: "FLWPUBK_TEST-02b9b5fc6406bd4a41c3ff141cc45e93-X",
  tx_ref: "txref-DI0NzMx13",
  currency: "NGN",
  payment_options: "card,mobilemoney,ussd",
  customizations: {
    logo: "https://st2.depositphotos.com/4403291/7418/v/450/depositphotos_74189661-stock-illustration-online-shop-log.jpg",
  },
};

export function usePayment({
  amount,
  customer,
  customizations,
}: {
  bookingId: string;
  amount: FlutterwaveConfig["amount"];
  customer: FlutterwaveConfig["customer"];
  customizations: FlutterwaveConfig["customizations"];
}) {
  // const fetcher = useFetcher<{ success: boolean; booking: Booking }>({
  //   key: "make-booking",
  // });
  const handlePayment = useFlutterwave({
    ...config,
    amount,
    customer,
    customizations: { ...config.customizations, ...customizations },
  });

  return {
    handlePayment,
  };
}
