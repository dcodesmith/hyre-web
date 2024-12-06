import { closePaymentModal, useFlutterwave } from "flutterwave-react-v3";
import { Booking } from "@prisma/client";
import { useFetcher, useNavigate } from "@remix-run/react";
import { FlutterwaveConfig } from "flutterwave-react-v3/dist/types";
import { useEffect } from "react";

const config = {
  public_key: "FLWPUBK_TEST-02b9b5fc6406bd4a41c3ff141cc45e93-X",
  tx_ref: "txref-DI0NzMx13",
  currency: "NGN",
  payment_options: "card,mobilemoney,ussd",
  customizations: {
    logo: "https://st2.depositphotos.com/4403291/7418/v/450/depositphotos_74189661-stock-illustration-online-shop-log.jpg",
  },
};

export default function PaymentButton({
  // bookingId,
  amount,
  customer,
  customizations,
}: {
  // bookingId: string;
  amount: FlutterwaveConfig["amount"];
  customer: FlutterwaveConfig["customer"];
  customizations: FlutterwaveConfig["customizations"];
}) {
  const navigate = useNavigate();
  const fetcher = useFetcher<{ success: boolean; booking: Booking }>({
    key: "make-booking",
  });
  const handleFlutterPayment = useFlutterwave({
    ...config,
    amount,
    customer,
    customizations: { ...config.customizations, ...customizations },
  });

  useEffect(() => {
    console.log("fetcher.data", fetcher.data);
    if (fetcher.data) {
      console.log("<<>>", fetcher.data);
      const bookingId = fetcher.data.booking.id;

      handleFlutterPayment({
        callback: ({ transaction_id: transactionId, status }) => {
          console.log("status", status);
          fetcher.submit(
            { transactionId, status },
            { method: "PATCH", action: `/bookings/${bookingId}` }
          );
          closePaymentModal(); // this will close the modal programmatically
          // navigate(`/dashboard`);
          // closePaymentModal(); // this will close the modal programmatically
        },
        onClose: () => {
          // navigate(`/dashboard`);
        },
      });
    }
  }, [handleFlutterPayment, fetcher, navigate]);

  // useEffect(() => {
  //   console.log("fetcher.data", fetcher.data);
  //   if (fetcher.data) {
  //     console.log("fetcher.data", fetcher.data);
  //     const bookingId = fetcher.data.booking.id;
  //   }
  // }, [fetcher, handleFlutterPayment]);

  return null;
  // onClick={onPayment}
  // return (
  //   <Button
  //     type="submit"
  //     className="rounded"
  //     onClick={() => fetcher.submit(null, { method: "post" })}
  //   >
  //     {fetcher.state === "submitting" ? "Submitting..." : "Book Now"}
  //   </Button>
  // );
}
