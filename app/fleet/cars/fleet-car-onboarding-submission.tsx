import { SendIcon } from "lucide-react";
import { Form, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export function CarSubmissionStep() {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "submit-car";

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle>
          <h3>Submit for Approval</h3>
        </CardTitle>
        <CardDescription>
          Submit this car for review. Its vehicle details, documents, photos, and pricing are ready.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="post">
          <input type="hidden" name="intent" value="submit-car" />
          <Button type="submit" disabled={pending} aria-live="polite">
            <SendIcon data-icon="inline-start" aria-hidden="true" />
            {pending ? "Submitting Car…" : "Submit Car for Approval"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}
