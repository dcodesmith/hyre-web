import { Check } from "lucide-react";
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useId,
  useRef,
  useState,
} from "react";

import { usePhoneVerification } from "~/auth/use-phone-verification";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import type { PhoneVerificationData } from "~/routes/api.phone-verification";

const PHONE_EXAMPLE = "+234 803 123 4675";

type PhoneEntrySubmit = (formData: FormData) => void;

const PhoneEntryContext = createContext<{
  readonly formId: string;
  readonly submitRef: { current: PhoneEntrySubmit };
} | null>(null);

export function PhoneVerificationRoot({ children }: { readonly children: ReactNode }) {
  const formId = `phone-entry-${useId().replaceAll(":", "")}`;
  const submitRef = useRef<PhoneEntrySubmit>(() => {});

  return (
    <PhoneEntryContext.Provider value={{ formId, submitRef }}>
      <form
        id={formId}
        hidden
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          submitRef.current(new FormData(event.currentTarget));
        }}
      />
      {children}
    </PhoneEntryContext.Provider>
  );
}

function PhoneEntryForm({
  className,
  children,
  onSubmit,
}: {
  readonly className: string;
  readonly children: ReactNode;
  readonly onSubmit: PhoneEntrySubmit;
}) {
  const entry = useContext(PhoneEntryContext);
  if (entry) {
    entry.submitRef.current = onSubmit;
  }

  if (!entry) {
    return (
      <form
        className={className}
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          event.stopPropagation();
          onSubmit(new FormData(event.currentTarget));
        }}
      >
        {children}
      </form>
    );
  }

  return <div className={className}>{children}</div>;
}

function usePhoneControlForm() {
  return useContext(PhoneEntryContext)?.formId;
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

function VerifiedPhone({
  phoneNumber,
  onChangeNumber,
}: {
  readonly phoneNumber: string;
  readonly onChangeNumber?: () => void;
}) {
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
      {onChangeNumber ? (
        <button
          type="button"
          className="self-start text-sm font-medium text-neutral-900 underline"
          onClick={onChangeNumber}
        >
          Change phone number
        </button>
      ) : null}
    </div>
  );
}

export function PhoneVerificationForm({
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
  const [editingNumber, setEditingNumber] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const awaitingCode = maskedPhoneNumber != null && !editingNumber;
  const phoneInvalid = phoneError != null || Boolean(fieldErrors?.phoneNumber?.length);
  const codeInvalid = codeError != null || Boolean(fieldErrors?.code?.length);
  const submittedPhone = toE164Phone(initialPhoneNumber) ?? initialPhoneNumber;
  const controlForm = usePhoneControlForm();

  const sendPhone = (value: string) => {
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

  const verifyCode = (value: string) => {
    if (pending) {
      return;
    }

    const nextCode = value.trim();
    if (!/^\d{4,10}$/.test(nextCode)) {
      setCodeError("Invalid code entered");
      return;
    }
    setCodeError(null);
    onCheck(submittedPhone, nextCode);
  };

  if (awaitingCode) {
    return (
      <PhoneEntryForm
        className="space-y-2"
        onSubmit={(formData) => verifyCode(String(formData.get("code") ?? ""))}
      >
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
              name="code"
              form={controlForm}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              spellCheck={false}
              defaultValue=""
              placeholder="6-digit code"
              aria-invalid={codeInvalid ? true : undefined}
              className={`${bookingPhoneInputClassName} ${codeInvalid ? "border-red-500" : ""}`}
              onChange={(event) => {
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
                onClick={() => onSend(submittedPhone)}
              >
                Resend code
              </button>
            </p>
            <FormError errors={codeError ? [codeError] : fieldErrors?.code} />
            <FormError errors={fieldErrors?.phoneNumber} />
            {notice ? <span className="sr-only">{notice}</span> : null}
          </div>
          <Button
            type="submit"
            form={controlForm}
            className="h-10 w-24 shrink-0 rounded-md"
            disabled={pending}
          >
            {pending ? "Verifying…" : "Verify"}
          </Button>
        </div>
        {error ? <FormError errors={[error]} /> : null}
      </PhoneEntryForm>
    );
  }

  return (
    <PhoneEntryForm
      className="space-y-1"
      onSubmit={(formData) => sendPhone(String(formData.get("phone") ?? ""))}
    >
      <Label htmlFor="booking-phone-number" className="block font-semibold leading-5">
        Phone Number
      </Label>
      <p className="text-sm leading-5 text-gray-700">We’ll send you a code to verify this number</p>
      <div className="flex items-center gap-2">
        <input
          id="booking-phone-number"
          name="phone"
          form={controlForm}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          spellCheck={false}
          defaultValue={initialPhoneNumber}
          placeholder={PHONE_EXAMPLE}
          aria-invalid={phoneInvalid ? true : undefined}
          className={`${bookingPhoneInputClassName} ${phoneInvalid ? "border-red-500" : ""}`}
          onChange={(event) => {
            if (phoneError) {
              setPhoneError(phoneValidationMessage(event.target.value));
            }
          }}
        />
        <Button
          type="submit"
          form={controlForm}
          className="h-10 shrink-0 rounded-md px-4"
          disabled={pending}
        >
          {pending ? "Sending…" : "Send code"}
        </Button>
      </div>
      <FormError errors={phoneError ? [phoneError] : fieldErrors?.phoneNumber} />
      {error ? <FormError errors={[error]} /> : null}
    </PhoneEntryForm>
  );
}

export function nextPhoneChangeState(
  current: { readonly changing: boolean; readonly fresh: boolean },
  result: PhoneVerificationData | null | undefined,
) {
  const fresh = current.fresh && result?.intent === "send-phone" ? false : current.fresh;
  const completed =
    current.changing && !fresh && result?.phoneVerified === true && result.intent === "check-phone";

  return {
    changing: completed ? false : current.changing,
    fresh,
  };
}

export function PhoneVerification({
  phone,
  hideWhenVerified = false,
  allowChange = false,
}: {
  readonly phone: ReturnType<typeof usePhoneVerification>;
  readonly hideWhenVerified?: boolean;
  readonly allowChange?: boolean;
}) {
  const result = phone.result;
  const [changingNumber, setChangingNumber] = useState(false);
  const [freshChange, setFreshChange] = useState(false);
  const change = nextPhoneChangeState({ changing: changingNumber, fresh: freshChange }, result);

  if (change.changing !== changingNumber) {
    setChangingNumber(change.changing);
  }
  if (change.fresh !== freshChange) {
    setFreshChange(change.fresh);
  }

  if (!result) {
    return null;
  }

  if (hideWhenVerified && result.phoneVerified && result.intent == null && !change.changing) {
    return null;
  }

  if (result.phoneVerified && !change.changing) {
    return (
      <VerifiedPhone
        phoneNumber={result.phoneNumber ?? result.maskedPhoneNumber ?? ""}
        onChangeNumber={
          allowChange
            ? () => {
                setChangingNumber(true);
                setFreshChange(true);
              }
            : undefined
        }
      />
    );
  }

  return (
    <PhoneVerificationForm
      key={`${result.phoneNumber ?? ""}:${change.fresh ? "change" : (result.maskedPhoneNumber ?? "")}`}
      initialPhoneNumber={result.phoneNumber ?? ""}
      maskedPhoneNumber={change.fresh ? null : result.maskedPhoneNumber}
      notice={result.notice}
      error={result.error}
      fieldErrors={result.fieldErrors}
      pending={phone.pending}
      onSend={phone.send}
      onCheck={phone.check}
    />
  );
}
