import type { PayoutNotificationProps } from "../app/modules/email/templates/payout-notification";
import { PayoutNotification } from "../app/modules/email/templates/payout-notification";

export default function PayoutNotificationPreview(props: PayoutNotificationProps) {
  return <PayoutNotification {...props} />;
}

PayoutNotificationPreview.PreviewProps = {
  name: "Sam Owner",
  amount: "₦125,000",
  bookingReference: "TRP-8F2K9Q",
};
