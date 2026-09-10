import { z } from "zod";

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";

const RETRY_MESSAGE = "Unable to complete this onboarding step. Please try again.";
const accountFieldErrorsSchema = z.array(
  z.object({
    field: z.enum([
      "accountType",
      "nin",
      "isOwnerDriver",
      "bankName",
      "bankCode",
      "accountNumber",
      "driversLicense",
      "lasdri",
      "businessName",
      "registrationNumber",
      "registrationType",
    ]),
    message: z.string().min(1),
  }),
);

type AccountType = "INDIVIDUAL" | "BUSINESS";
type AccountReplyOptions = {
  fieldErrors?: Record<string, string[]>;
  formErrors?: string[];
};

function apiFieldErrorReply(error: ApiRequestError): AccountReplyOptions | undefined {
  const parsedErrors = accountFieldErrorsSchema.safeParse(error.problem.errors);
  if (!parsedErrors.success || parsedErrors.data.length === 0) {
    return undefined;
  }

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsedErrors.data) {
    const field = issue.field === "bankName" ? "bankCode" : issue.field;
    const messages = fieldErrors[field];
    if (messages) {
      messages.push(issue.message);
    } else {
      fieldErrors[field] = [issue.message];
    }
  }
  return { fieldErrors };
}

function knownAccountErrorReply(
  errorCode: string | undefined,
  accountType: AccountType,
): AccountReplyOptions | undefined {
  switch (errorCode) {
    case "ACCOUNT_NIN_NOT_VERIFIED":
      return {
        fieldErrors: {
          nin: ["We couldn't verify this NIN. Check the number and try again."],
        },
      };
    case "ACCOUNT_CAC_NOT_VERIFIED":
      return {
        fieldErrors: {
          registrationNumber: ["We couldn't verify these CAC details. Check them and try again."],
        },
      };
    case "PROVIDER_REJECTED":
      return accountType === "INDIVIDUAL"
        ? {
            fieldErrors: {
              nin: ["We couldn't verify this NIN. Check the number and try again."],
            },
          }
        : {
            formErrors: [
              "We couldn't verify the representative's NIN or CAC details. Check them and try again.",
            ],
          };
    case "BANK_ACCOUNT_UNRESOLVED":
      return {
        fieldErrors: {
          accountNumber: ["We couldn't verify this account. Check the bank and account number."],
        },
      };
    case "BANK_ACCOUNT_NAME_MISMATCH":
      return {
        fieldErrors: {
          accountNumber: ["This account name doesn't match the verified identity."],
        },
      };
    case "BUSINESS_NAME_MISMATCH":
      return {
        fieldErrors: {
          businessName: ["This name doesn't match the CAC record."],
        },
      };
    case "BUSINESS_INACTIVE":
      return {
        fieldErrors: {
          registrationNumber: ["This business isn't active on the CAC record."],
        },
      };
    case "OWNER_DRIVER_LICENSE_REQUIRED":
      return {
        fieldErrors: {
          driversLicense: ["Upload your driver's licence to continue."],
        },
      };
    case "VERIFICATION_IDEMPOTENCY_KEY_REUSED":
    case "ACCOUNT_VERIFICATION_CHANGED":
      return {
        formErrors: ["Your details changed. Please submit them again."],
      };
    case "ACCOUNT_VERIFICATION_STEP_INCOMPLETE":
      return {
        formErrors: ["Finish the previous step before continuing."],
      };
    default:
      return undefined;
  }
}

export function accountErrorMessage(error: unknown, accountType: AccountType = "INDIVIDUAL") {
  const reply = accountErrorReply(error, accountType);
  return reply.formErrors?.[0] ?? Object.values(reply.fieldErrors ?? {}).flat()[0] ?? RETRY_MESSAGE;
}

export function accountErrorReply(error: unknown, accountType: AccountType): AccountReplyOptions {
  if (!(error instanceof ApiRequestError) || error.kind !== "http") {
    return { formErrors: [RETRY_MESSAGE] };
  }

  const fieldReply = apiFieldErrorReply(error);
  if (fieldReply) {
    return fieldReply;
  }

  const knownReply = knownAccountErrorReply(error.problem.errorCode, accountType);
  if (knownReply) {
    return knownReply;
  }

  if (error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    return {
      formErrors: ["We couldn't verify these details. Check them and try again."],
    };
  }

  return { formErrors: [RETRY_MESSAGE] };
}

export function accountRetryKey(error: unknown, currentKey: string) {
  if (
    !(error instanceof ApiRequestError) ||
    error.kind !== "http" ||
    error.problem.errorCode === "VERIFICATION_REQUEST_IN_PROGRESS"
  ) {
    return currentKey;
  }
  return crypto.randomUUID();
}
