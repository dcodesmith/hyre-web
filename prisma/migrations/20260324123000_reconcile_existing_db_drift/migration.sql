-- Reconcile migration made idempotent for environments where these objects already exist.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingDraftStatus') THEN
    CREATE TYPE "public"."BookingDraftStatus" AS ENUM ('NEW', 'COLLECTING', 'QUOTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'CLOSED', 'CANCELLED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WhatsAppConversationStatus') THEN
    CREATE TYPE "public"."WhatsAppConversationStatus" AS ENUM ('ACTIVE', 'HANDOFF', 'CLOSED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WhatsAppDeliveryMode') THEN
    CREATE TYPE "public"."WhatsAppDeliveryMode" AS ENUM ('FREE_FORM', 'TEMPLATE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WhatsAppMessageDirection') THEN
    CREATE TYPE "public"."WhatsAppMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WhatsAppMessageKind') THEN
    CREATE TYPE "public"."WhatsAppMessageKind" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT', 'LOCATION', 'INTERACTIVE', 'SYSTEM', 'UNKNOWN');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WhatsAppMessageStatus') THEN
    CREATE TYPE "public"."WhatsAppMessageStatus" AS ENUM ('RECEIVED', 'QUEUED', 'PROCESSED', 'SENT', 'DELIVERED', 'READ', 'FAILED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WhatsAppOutboxStatus') THEN
    CREATE TYPE "public"."WhatsAppOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'DEAD_LETTER');
  END IF;
END $$;

ALTER TYPE "public"."PaymentAttemptStatus" ADD VALUE IF NOT EXISTS 'REFUND_ERROR';

ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "refundIdempotencyKey" TEXT;

-- Normalize acquisition partner fields before enforcing the Booking check constraint.
UPDATE "public"."Booking"
SET
  "acquisitionPartnerOwnerId" = NULL,
  "acquisitionPartnerSlug" = NULL
WHERE "acquisitionChannel" <> 'PARTNER';

UPDATE "public"."Booking"
SET "acquisitionChannel" = 'GLOBAL'
WHERE
  "acquisitionChannel" = 'PARTNER'
  AND "acquisitionPartnerOwnerId" IS NULL
  AND "acquisitionPartnerSlug" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Booking_acquisition_channel_partner_fields_check'
  ) THEN
    ALTER TABLE "public"."Booking"
    ADD CONSTRAINT "Booking_acquisition_channel_partner_fields_check"
    CHECK (
      (
        "acquisitionChannel" = 'PARTNER'
        AND (
          "acquisitionPartnerOwnerId" IS NOT NULL
          OR "acquisitionPartnerSlug" IS NOT NULL
        )
      )
      OR (
        "acquisitionChannel" <> 'PARTNER'
        AND "acquisitionPartnerOwnerId" IS NULL
        AND "acquisitionPartnerSlug" IS NULL
      )
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."BookingDraft" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" "public"."BookingDraftStatus" NOT NULL DEFAULT 'NEW',
    "state" JSONB NOT NULL,
    "selectedOptionId" TEXT,
    "quoteExpiresAt" TIMESTAMP(3),
    "checkoutUrl" TEXT,
    "checkoutExpiresAt" TIMESTAMP(3),
    "linkedBookingId" TEXT,
    "paymentStatus" "public"."PaymentStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookingDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."WhatsAppConversation" (
    "id" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "waId" TEXT,
    "profileName" TEXT,
    "status" "public"."WhatsAppConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "windowExpiresAt" TIMESTAMP(3),
    "handoffReason" TEXT,
    "handoffAt" TIMESTAMP(3),
    "activeBookingDraftId" TEXT,
    "processingLockToken" TEXT,
    "processingLockExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "providerMessageSid" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "direction" "public"."WhatsAppMessageDirection" NOT NULL,
    "kind" "public"."WhatsAppMessageKind" NOT NULL DEFAULT 'UNKNOWN',
    "status" "public"."WhatsAppMessageStatus" NOT NULL DEFAULT 'RECEIVED',
    "body" TEXT,
    "mediaUrl" TEXT,
    "mediaContentType" TEXT,
    "providerStatus" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "rawPayload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."WhatsAppOutbox" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "mode" "public"."WhatsAppDeliveryMode" NOT NULL,
    "status" "public"."WhatsAppOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "textBody" TEXT,
    "mediaUrl" TEXT,
    "templateName" TEXT,
    "templateVariables" JSONB,
    "payload" JSONB,
    "providerMessageSid" TEXT,
    "failureReason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BookingDraft_conversationId_status_idx" ON "public"."BookingDraft"("conversationId" ASC, "status" ASC);
CREATE INDEX IF NOT EXISTS "BookingDraft_updatedAt_idx" ON "public"."BookingDraft"("updatedAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppConversation_phoneE164_key" ON "public"."WhatsAppConversation"("phoneE164" ASC);
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_processingLockExpiresAt_idx" ON "public"."WhatsAppConversation"("processingLockExpiresAt" ASC);
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_status_idx" ON "public"."WhatsAppConversation"("status" ASC);
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppConversation_waId_key" ON "public"."WhatsAppConversation"("waId" ASC);
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_windowExpiresAt_idx" ON "public"."WhatsAppConversation"("windowExpiresAt" ASC);

CREATE INDEX IF NOT EXISTS "WhatsAppMessage_conversationId_receivedAt_idx" ON "public"."WhatsAppMessage"("conversationId" ASC, "receivedAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppMessage_dedupeKey_key" ON "public"."WhatsAppMessage"("dedupeKey" ASC);
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_direction_status_idx" ON "public"."WhatsAppMessage"("direction" ASC, "status" ASC);
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppMessage_providerMessageSid_key" ON "public"."WhatsAppMessage"("providerMessageSid" ASC);

CREATE INDEX IF NOT EXISTS "WhatsAppOutbox_conversationId_createdAt_idx" ON "public"."WhatsAppOutbox"("conversationId" ASC, "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppOutbox_dedupeKey_key" ON "public"."WhatsAppOutbox"("dedupeKey" ASC);
CREATE INDEX IF NOT EXISTS "WhatsAppOutbox_status_nextAttemptAt_idx" ON "public"."WhatsAppOutbox"("status" ASC, "nextAttemptAt" ASC);

-- Preflight-dedupe FlightStatusEvent rows before unique index creation.
DO $$
DECLARE
  duplicate_groups BIGINT;
BEGIN
  WITH ranked AS (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "flightId", "eventType", "eventTime"
        ORDER BY "createdAt" ASC, "id" ASC
      ) AS row_num
    FROM "public"."FlightStatusEvent"
  )
  DELETE FROM "public"."FlightStatusEvent" AS fse
  USING ranked
  WHERE ranked.row_num > 1 AND ranked."id" = fse."id";

  SELECT COUNT(*)
  INTO duplicate_groups
  FROM (
    SELECT 1
    FROM "public"."FlightStatusEvent"
    GROUP BY "flightId", "eventType", "eventTime"
    HAVING COUNT(*) > 1
  ) AS remaining_duplicates;

  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION
      'Cannot create FlightStatusEvent_flightId_eventType_eventTime_key: % duplicate key group(s) remain in FlightStatusEvent',
      duplicate_groups;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "FlightStatusEvent_flightId_eventType_eventTime_key" ON "public"."FlightStatusEvent"("flightId" ASC, "eventType" ASC, "eventTime" ASC);
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_refundIdempotencyKey_key" ON "public"."Payment"("refundIdempotencyKey" ASC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingDraft_conversationId_fkey') THEN
    ALTER TABLE "public"."BookingDraft" ADD CONSTRAINT "BookingDraft_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "public"."WhatsAppConversation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingDraft_linkedBookingId_fkey') THEN
    ALTER TABLE "public"."BookingDraft" ADD CONSTRAINT "BookingDraft_linkedBookingId_fkey"
      FOREIGN KEY ("linkedBookingId") REFERENCES "public"."Booking"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppConversation_activeBookingDraftId_fkey') THEN
    ALTER TABLE "public"."WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_activeBookingDraftId_fkey"
      FOREIGN KEY ("activeBookingDraftId") REFERENCES "public"."BookingDraft"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppMessage_conversationId_fkey') THEN
    ALTER TABLE "public"."WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "public"."WhatsAppConversation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppOutbox_conversationId_fkey') THEN
    ALTER TABLE "public"."WhatsAppOutbox" ADD CONSTRAINT "WhatsAppOutbox_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "public"."WhatsAppConversation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;