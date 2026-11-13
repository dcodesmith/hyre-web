import { getFormProps, getInputProps, type SubmissionResult, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, useNavigation } from "react-router";
import { AccountDeletion } from "~/account/account-deletion";
import { profileFormSchema } from "~/account/profile-form-schema";
import type { CurrentUserProfile } from "~/api/users/schema";
import { isLogoutFormAction } from "~/auth/logout-navigation";
import { PhoneVerification, PhoneVerificationRoot } from "~/auth/phone-verification";
import { phoneVerificationFromProfile, usePhoneVerification } from "~/auth/use-phone-verification";
import { DetailCard, DetailCardBody, DetailCardHeader } from "~/booking/booking-detail-card";
import { Button } from "~/components/ui/button";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";

const onboardingInputClassName = "h-10 rounded-sm";
const profileButtonClassName =
  "h-12 w-[152px] rounded-md bg-[#171717] px-4 py-2 text-sm leading-5 font-medium text-[#fafafa] shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] hover:bg-[#171717]";

type ProfileFields = {
  readonly email: string;
  readonly profile: CurrentUserProfile;
  readonly lastResult?: SubmissionResult<string[]>;
};

export function ProfilePage({ email, profile, lastResult }: ProfileFields) {
  const navigation = useNavigation();
  const isLoggingOut = navigation.formMethod != null && isLogoutFormAction(navigation.formAction);
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
  const phone = usePhoneVerification(phoneVerificationFromProfile(profile));

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[571px] px-4 pt-4 pb-24 md:px-0 md:pt-6 md:pb-6">
        <header className="mb-4 md:mb-6">
          <h1 className="text-2xl leading-9 font-semibold tracking-tight text-pretty text-gray-900 md:text-3xl md:tracking-normal">
            Your Profile
          </h1>
          <p className="mt-1 text-sm leading-5 text-[#4b5563] md:mt-2 md:text-base">
            Update your information and manage your account
          </p>
        </header>
        <PhoneVerificationRoot>
          <Form method="post" {...getFormProps(form)}>
            <DetailCard>
              <DetailCardHeader>
                <h2>Personal Information</h2>
              </DetailCardHeader>
              <DetailCardBody>
                <div className="profile-fields">
                  {lastResult?.status === "success" ? (
                    <output className="mb-5 block text-sm text-green-700">Saved.</output>
                  ) : null}

                  <div className="space-y-5 text-foreground" data-profile-fields="uniform">
                    <Field data-invalid={Boolean(name.errors)}>
                      <FieldLabel htmlFor={name.id}>Name</FieldLabel>
                      <Input
                        {...getInputProps(name, { type: "text" })}
                        className={onboardingInputClassName}
                        autoComplete="name"
                        placeholder="Enter name"
                        aria-invalid={name.errors ? true : undefined}
                      />
                      <FieldError
                        id={name.errorId}
                        errors={name.errors?.map((message) => ({ message }))}
                      />
                    </Field>

                    <Field data-disabled>
                      <FieldLabel htmlFor="profile-email">Email</FieldLabel>
                      <Input
                        id="profile-email"
                        type="email"
                        value={email}
                        readOnly
                        disabled
                        autoComplete="email"
                        className={onboardingInputClassName}
                      />
                    </Field>

                    <PhoneVerification phone={phone} allowChange appearance="profile" />

                    <Field data-invalid={Boolean(city.errors)}>
                      <FieldLabel htmlFor={city.id}>City</FieldLabel>
                      <Input
                        {...getInputProps(city, { type: "text" })}
                        className={onboardingInputClassName}
                        autoComplete="address-level2"
                        placeholder="Enter city"
                        aria-invalid={city.errors ? true : undefined}
                      />
                      <FieldError
                        id={city.errorId}
                        errors={city.errors?.map((message) => ({ message }))}
                      />
                    </Field>

                    <Field data-invalid={Boolean(address.errors)}>
                      <FieldLabel htmlFor={address.id}>Address</FieldLabel>
                      <Input
                        {...getInputProps(address, { type: "text" })}
                        className={onboardingInputClassName}
                        autoComplete="street-address"
                        placeholder="Enter address"
                        aria-invalid={address.errors ? true : undefined}
                      />
                      <FieldError
                        id={address.errorId}
                        errors={address.errors?.map((message) => ({ message }))}
                      />
                    </Field>
                  </div>

                  <FieldError
                    className="mt-5"
                    id={form.errorId}
                    errors={form.errors?.map((message) => ({ message }))}
                  />

                  <div className="profile-after-phone mt-6 transition-transform md:mt-8">
                    <Button
                      type="submit"
                      className={profileButtonClassName}
                      disabled={isSaving}
                      aria-live="polite"
                    >
                      {isSaving ? "Saving…" : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </DetailCardBody>
            </DetailCard>
          </Form>

          <DetailCard className="mt-8">
            <DetailCardHeader>
              <h2>Privacy and Security</h2>
            </DetailCardHeader>
            <DetailCardBody>
              <div className="flex items-start justify-between gap-8">
                <label htmlFor={marketingConsent.id} className="min-w-0 cursor-pointer">
                  <span className="block text-sm leading-5 font-semibold text-[#111827]">
                    Marketing communications
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-[#4b5563]">
                    Receive updates about new features, promotions, and travel tips.
                  </span>
                </label>
                <Switch
                  id={marketingConsent.id}
                  name={marketingConsent.name}
                  value="on"
                  defaultChecked={profile.marketingConsent}
                  form={form.id}
                  aria-label="Marketing communications"
                  className="h-6! w-11! bg-[#e5e7eb] data-checked:bg-[#111827] [&_[data-slot=switch-thumb]]:size-5! [&_[data-slot=switch-thumb]]:shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_0_rgba(0,0,0,0.06)] data-checked:[&_[data-slot=switch-thumb]]:translate-x-[22px]!"
                />
              </div>
              <Separator className="mt-3 bg-[#e5e7eb] md:mt-8" />
              <div className="mt-8">
                <AccountDeletion />
              </div>
              <Form method="post" action="/logout" className="mt-8">
                <Button
                  type="submit"
                  variant="outline"
                  className="h-12"
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? "Logging out…" : "Log out"}
                </Button>
              </Form>
            </DetailCardBody>
          </DetailCard>
        </PhoneVerificationRoot>
      </div>
    </div>
  );
}
