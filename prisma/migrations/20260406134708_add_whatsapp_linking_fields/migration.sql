-- Create enum only if it does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'WhatsAppLinkStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "WhatsAppLinkStatus" AS ENUM ('UNLINKED', 'PENDING_VERIFICATION', 'LINKED', 'REVOKED');
  END IF;
END
$$;

-- Add columns only when missing.
ALTER TABLE "WhatsAppConversation"
  ADD COLUMN IF NOT EXISTS "linkRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "linkStatus" "WhatsAppLinkStatus" NOT NULL DEFAULT 'UNLINKED',
  ADD COLUMN IF NOT EXISTS "linkVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "linkedUserId" TEXT;

-- Create indexes only when missing.
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_linkedUserId_idx" ON "WhatsAppConversation"("linkedUserId");
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_linkStatus_idx" ON "WhatsAppConversation"("linkStatus");

-- Add FK only when missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WhatsAppConversation_linkedUserId_fkey'
      AND conrelid = 'public."WhatsAppConversation"'::regclass
  ) THEN
    ALTER TABLE "WhatsAppConversation"
      ADD CONSTRAINT "WhatsAppConversation_linkedUserId_fkey"
      FOREIGN KEY ("linkedUserId")
      REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END
$$;

