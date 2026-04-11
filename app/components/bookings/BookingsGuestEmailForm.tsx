import { Form } from "~/components/CSRFForm";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export function BookingsGuestEmailForm() {
  return (
    <div className="max-w-md mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4">Find Your Bookings</h2>
      <Form method="post" action="/bookings/lookup" className="space-y-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="guestEmail">Enter your email address</Label>
          <Input id="guestEmail" name="email" type="email" placeholder="your@email.com" required />
        </div>
        <Button type="submit" className="w-full">
          Find Bookings
        </Button>
      </Form>
    </div>
  );
}
