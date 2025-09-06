/*
  Warnings:

  - You are about to drop the `Permission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_PermissionToRole` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_fleetOwnerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."_PermissionToRole" DROP CONSTRAINT "_PermissionToRole_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_PermissionToRole" DROP CONSTRAINT "_PermissionToRole_B_fkey";

-- DropTable
DROP TABLE "public"."Permission";

-- DropTable
DROP TABLE "public"."_PermissionToRole";

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_fleetOwnerId_fkey" FOREIGN KEY ("fleetOwnerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
