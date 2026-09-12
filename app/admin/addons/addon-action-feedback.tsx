import type { AddonActionData } from "~/admin/addons/addon-form-schema";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

export function AddonActionFeedback({
  data,
  title,
}: {
  readonly data?: AddonActionData;
  readonly title: string;
}) {
  if (!data?.error && !data?.success) {
    return null;
  }

  return (
    <Alert variant={data.error ? "destructive" : "default"}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{data.error ?? data.success}</AlertDescription>
    </Alert>
  );
}
