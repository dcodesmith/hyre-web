import { getFormProps, getInputProps, type SubmissionResult, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, Link, useNavigation } from "react-router";
import { AccountDeletion } from "~/account/account-deletion";
import { profileFormSchema } from "~/account/profile-form-schema";
import type { CurrentUserProfile } from "~/api/users/schema";
import { AuthCheckbox } from "~/auth/auth-form-primitives";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";

const fieldClassName = "h-9 w-full rounded-md border px-3 text-sm";
const profilePhoneVerificationUrl = "/verify-phone?redirectTo=%2Fprofile";

type ProfileFields = {
  readonly email: string;
  readonly profile: CurrentUserProfile;
  readonly lastResult?: SubmissionResult<string[]>;
};

export function ProfilePage({ email, profile, lastResult }: ProfileFields) {
  const navigation = useNavigation();
  const isSaving =
    navigation.formMethod != null &&
    navigation.formAction != null &&
    new URL(navigation.formAction, "https://tripdly.com").pathname.endsWith("/profile");
  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(profileFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    defaultValue: {
      name: profile.name ?? "",
      city: profile.city ?? "",
      address: profile.address ?? "",
      marketingConsent: profile.marketingConsent ? "on" : "",
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: profileFormSchema });
    },
  });
  const { name, city, address, marketingConsent } = fields;

  return (
    <div className="w-full">
      <div className="mx-auto max-w-4xl px-4 py-4 md:py-6">
        <h1 className="mb-4 text-pretty text-2xl font-bold">Edit Profile</h1>
        <Form method="post" {...getFormProps(form)} className="max-w-md space-y-4">
          {lastResult?.status === "success" ? (
            <output className="block text-sm text-green-700">Saved.</output>
          ) : null}

          <div className="space-y-1">
            <label htmlFor="profile-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="profile-email"
              type="email"
              value={email}
              readOnly
              disabled
              autoComplete="email"
              className={`${fieldClassName} disabled:opacity-50`}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={name.id} className="text-sm font-medium">
              Name
            </label>
            <input
              {...getInputProps(name, { type: "text" })}
              autoComplete="name"
              className={fieldClassName}
            />
            <FormError id={name.errorId} errors={name.errors} />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Phone</p>
            <div className="flex min-h-9 items-center justify-between gap-3 rounded-md border px-3 text-sm">
              <span className="min-w-0 truncate">{profile.phoneNumber ?? "Not added"}</span>
              <span className={profile.phoneVerified ? "text-green-700" : "text-amber-700"}>
                {profile.phoneVerified ? "Verified" : "Not verified"}
              </span>
            </div>
            <Link
              to={`${profilePhoneVerificationUrl}${profile.phoneVerified ? "&change=phone" : ""}`}
              className="inline-block text-sm font-medium text-neutral-900 underline"
            >
              {profile.phoneVerified ? "Change phone number" : "Verify phone number"}
            </Link>
          </div>

          <div className="space-y-1">
            <label htmlFor={city.id} className="text-sm font-medium">
              City
            </label>
            <input
              {...getInputProps(city, { type: "text" })}
              autoComplete="address-level2"
              className={fieldClassName}
            />
            <FormError id={city.errorId} errors={city.errors} />
          </div>

          <div className="space-y-1">
            <label htmlFor={address.id} className="text-sm font-medium">
              Address
            </label>
            <input
              {...getInputProps(address, { type: "text" })}
              autoComplete="street-address"
              className={fieldClassName}
            />
            <FormError id={address.errorId} errors={address.errors} />
          </div>

          <label htmlFor={marketingConsent.id} className="flex cursor-pointer items-start gap-2.5">
            <AuthCheckbox {...getInputProps(marketingConsent, { type: "checkbox", value: "on" })} />
            <span>
              <span className="block text-sm font-medium">Marketing communications</span>
              <span className="block text-sm text-muted-foreground">
                Receive updates about new features, promotions, and travel tips.
              </span>
            </span>
          </label>

          <FormError id={form.errorId} errors={form.errors} />

          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save Changes"}
          </Button>
        </Form>
        <AccountDeletion />
      </div>
    </div>
  );
}
