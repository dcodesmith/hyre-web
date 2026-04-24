import { Heading, Section, Text, render } from "react-email";
import { EmailTemplate } from "./EmailTemplate";

export interface PayoutNotificationProps {
  readonly name: string;
  readonly amount: string;
  readonly bookingReference: string;
}

export function PayoutNotification({ name, amount, bookingReference }: PayoutNotificationProps) {
  return (
    <EmailTemplate previewText="You have received a new payout">
      <Heading className="text-2xl font-semibold text-gray-800">Payout Notification</Heading>
      <Section>
        <Text className="text-base text-gray-700">Hi {name},</Text>
        <Text className="text-base text-gray-700">
          A payout for booking reference {bookingReference} of {amount} has been successfully
          processed and sent to your account.
        </Text>
        <Text className="text-base text-gray-700">Thank you for your partnership.</Text>
      </Section>
    </EmailTemplate>
  );
}

export function renderPayoutNotificationEmail({
  name,
  amount,
  bookingReference,
}: PayoutNotificationProps) {
  return render(
    <PayoutNotification name={name} amount={amount} bookingReference={bookingReference} />,
  );
}
