-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_fleetOwnerId_fkey";

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_fleetOwnerId_fkey" FOREIGN KEY ("fleetOwnerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
