-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_bankDetailsId_fkey";

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_bankDetailsId_fkey" FOREIGN KEY ("bankDetailsId") REFERENCES "BankDetails"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
