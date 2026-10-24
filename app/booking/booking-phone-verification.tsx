import { Check } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

import { useBookingPhoneVerification } from "~/booking/use-booking-phone-verification";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import type { PhoneVerificationData } from "~/routes/api.phone-verification";

const PHONE_EXAMPLE = "+234 803 123 4675";

function isImeEnter(event: KeyboardEvent<HTMLInputElement>) {
  return event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
}

export const bookingPhoneInputClassName =
  "flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export function toE164Phone(value: string) {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(compact)) {
    return compact;
  }
  if (/^0\d{10}$/.test(compact)) {
    return `+234${compact.slice(1)}`;
  }
  return null;
}

export function phoneValidationMessage(value: string) {
  return toE164Phone(value) ? null : "Invalid phone number";
}

function VerifiedPhone({ phoneNumber }: { readonly phoneNumber: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="block text-sm font-semibold leading-5">Phone Number</Label>
      <div className="flex items-center gap-4 rounded border border-emerald-700 bg-emerald-100 px-3.5 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white">
          <Check aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium leading-5 text-gray-900">
            {phoneNumber}
          </span>
          <span className="block text-xs leading-5 text-gray-900">Phone number verified</span>
        </span>
      </div>
    </div>
  );
}

export function BookingPhoneVerificationForm({
  initialPhoneNumber,
  maskedPhoneNumber,
  notice,
  error,
  fieldErrors,
  pending,
  onSend,
  onCheck,
}: {
  readonly initialPhoneNumber: string;
  readonly maskedPhoneNumber: string | null;
  readonly notice: string | null;
  readonly error: string | null;
  readonly fieldErrors: PhoneVerificationData["fieldErrors"];
  readonly pending: boolean;
  readonly onSend: (phoneNumber: string) => void;
  readonly onCheck: (phoneNumber: string, code: string) => void;
}) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
  const [code, setCode] = useState("");
  const [editingNumber, setEditingNumber] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const awaitingCode = maskedPhoneNumber != null && !editingNumber;
  const phoneInvalid = phoneError != null || Boolean(fieldErrors?.phoneNumber?.length);
  const codeInvalid = codeError != null || Boolean(fieldErrors?.code?.length);

  const sendPhone = (value = phoneNumber) => {
    if (pending) {
      return;
    }

    const message = phoneValidationMessage(value);
    setPhoneError(message);
    if (message) {
      return;
    }
    setEditingNumber(false);
    onSend(toE164Phone(value) ?? value);
  };

  const verifyCode = (value = code) => {
    if (pending) {
      return;
    }

    const nextCode = value.trim();
    if (!/^\d{4,10}$/.test(nextCode)) {
      setCodeError("Invalid code entered");
      return;
    }
    setCodeError(null);
    onCheck(toE164Phone(phoneNumber) ?? phoneNumber, nextCode);
  };

  if (awaitingCode) {
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <Label htmlFor="booking-phone-code" className="block font-semibold leading-5">
            Enter Verification Code
          </Label>
          <p className="text-sm leading-5 text-gray-700" aria-live="polite">
            We sent a code to {maskedPhoneNumber}{" "}
            <button
              type="button"
              className="font-medium text-emerald-500 hover:text-emerald-600"
              onClick={() => setEditingNumber(true)}
            >
              Edit number
            </button>
          </p>
        </div>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <input
              id="booking-phone-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              spellCheck={false}
              value={code}
              placeholder="6-digit code"
              aria-invalid={codeInvalid ? true : undefined}
              className={`${bookingPhoneInputClassName} ${codeInvalid ? "border-red-500" : ""}`}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || isImeEnter(event)) {
                  return;
                }
                event.preventDefault();
                verifyCode(event.currentTarget.value);
              }}
              onChange={(event) => {
                setCode(event.target.value);
                if (codeError) {
                  const nextCode = event.target.value.trim();
                  setCodeError(/^\d{4,10}$/.test(nextCode) ? null : "Invalid code entered");
                }
              }}
            />
            <p className="text-xs leading-4 text-gray-500">
              Didn’t get it?{" "}
              <button
                type="button"
                className="text-gray-900 underline"
                disabled={pending}
                onClick={() => onSend(toE164Phone(phoneNumber) ?? phoneNumber)}
              >
                Resend code
              </button>
            </p>
            <FormError errors={codeError ? [codeError] : fieldErrors?.code} />
            <FormError errors={fieldErrors?.phoneNumber} />
            {notice ? <span className="sr-only">{notice}</span> : null}
          </div>
          <Button
            type="button"
            className="h-10 w-24 shrink-0 rounded-md"
            disabled={pending}
            onClick={() => verifyCode()}
          >
            {pending ? "Verifying…" : "Verify"}
          </Button>
        </div>
        {error ? <FormError errors={[error]} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor="booking-phone-number" className="block font-semibold leading-5">
        Phone Number
      </Label>
      <p className="text-sm leading-5 text-gray-700">We’ll send you a code to verify this number</p>
      <div className="flex items-center gap-2">
        <input
          id="booking-phone-number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          spellCheck={false}
          value={phoneNumber}
          placeholder={PHONE_EXAMPLE}
          aria-invalid={phoneInvalid ? true : undefined}
          className={`${bookingPhoneInputClassName} ${phoneInvalid ? "border-red-500" : ""}`}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || isImeEnter(event)) {
              return;
            }
            event.preventDefault();
            sendPhone(event.currentTarget.value);
          }}
          onChange={(event) => {
            setPhoneNumber(event.target.value);
            if (phoneError) {
              setPhoneError(phoneValidationMessage(event.target.value));
            }
          }}
        />
        <Button
          type="button"
          className="h-10 shrink-0 rounded-md px-4"
          disabled={pending}
          onClick={() => sendPhone()}
        >
          {pending ? "Sending…" : "Send code"}
        </Button>
      </div>
      <FormError errors={phoneError ? [phoneError] : fieldErrors?.phoneNumber} />
      {error ? <FormError errors={[error]} /> : null}
    </div>
  );
}

export function BookingPhoneVerification({
  phone,
}: {
  readonly phone: ReturnType<typeof useBookingPhoneVerification>;
}) {
  const result = phone.visible;

  if (!result) {
    return null;
  }

  if (result.phoneVerified) {
    return <VerifiedPhone phoneNumber={result.phoneNumber ?? result.maskedPhoneNumber ?? ""} />;
  }

  return (
    <BookingPhoneVerificationForm
      key={`${result.phoneNumber ?? ""}:${result.maskedPhoneNumber ?? ""}`}
      initialPhoneNumber={result.phoneNumber ?? ""}
      maskedPhoneNumber={result.maskedPhoneNumber}
      notice={result.notice}
      error={result.error}
      fieldErrors={result.fieldErrors}
      pending={phone.pending}
      onSend={phone.send}
      onCheck={phone.check}
    />
  );
}
