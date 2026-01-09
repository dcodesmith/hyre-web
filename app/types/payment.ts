export interface FlutterwaveCustomer {
  id: number;
  name: string;
  phone_number: string | null;
  email: string;
  created_at: string;
}

export interface FlutterwaveCard {
  first_6digits: string;
  last_4digits: string;
  issuer: string;
  country: string;
  type: string;
  expiry: string;
}

export interface FlutterwaveChargeData {
  id: number;
  tx_ref: string;
  flw_ref: string;
  device_fingerprint: string;
  amount: number;
  currency: string;
  charged_amount: number;
  app_fee: number;
  merchant_fee: number;
  processor_response: string;
  auth_model: string;
  ip: string;
  narration: string;
  status: "successful" | "failed";
  payment_type: string;
  created_at: string;
  account_id: number;
  customer: FlutterwaveCustomer;
  card?: FlutterwaveCard;
}

export interface FlutterwaveMetaData {
  transactionType: "booking_creation" | "booking_extension";
  [key: string]: any;
}

export interface FlutterwaveChargeCompletedPayload {
  event: "charge.completed";
  data: FlutterwaveChargeData;
  meta_data: FlutterwaveMetaData;
  "event.type": string;
}

export interface FlutterwaveRefundPayload {
  id: number;
  AmountRefunded: number;
  status:
    | "completed"
    | "completed-bank-transfer"
    | "completed-momo"
    | "completed-mpgs"
    | "completed-offline"
    | "completed-preauth"
    | "pending-momo"
    | "processing"
    | "failed";
  FlwRef: string;
  destination: string;
  comments: string | null;
  settlement_id: string;
  meta: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  walletId: number;
  AccountId: number;
  TransactionId: number;
}

export type FlutterwaveWebhookPayload =
  | FlutterwaveChargeCompletedPayload
  | FlutterwaveRefundPayload
  | FlutterwaveTransferCompletedPayload;

export function isChargeCompletedPayload(
  payload: unknown,
): payload is FlutterwaveChargeCompletedPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const p = payload as Partial<FlutterwaveChargeCompletedPayload>;

  return (
    p.event === "charge.completed" && typeof p.data === "object" && typeof p.meta_data === "object"
  );
}

export function isRefundPayload(payload: unknown): payload is FlutterwaveRefundPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const p = payload as Partial<FlutterwaveRefundPayload>;

  return "AmountRefunded" in p && "FlwRef" in p && !("event" in p);
}

export type FlutterwaveTransferCompletedPayload = {
  event: "transfer.completed";
  data: {
    id: number;
    account_number: string;
    bank_name: string;
    bank_code: string;
    fullname: string;
    created_at: string;
    currency: string;
    debit_currency: string;
    amount: number;
    fee: number;
    status: "SUCCESSFUL" | "FAILED" | "PENDING" | "ON_HOLD";
    reference: string;
    meta: any | null;
    narration: string;
    complete_message: string;
    requires_approval: 0 | 1;
    is_approved: 0 | 1;
  };
};

export function isTransferCompletedPayload(
  payload: unknown,
): payload is FlutterwaveTransferCompletedPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const p = payload as Partial<FlutterwaveTransferCompletedPayload>;
  return p.event === "transfer.completed" && typeof p.data === "object";
}
