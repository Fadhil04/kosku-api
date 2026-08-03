/*
  Warnings:

  - You are about to drop the column `late_fee_max_percentage` on the `bills` table. All the data in the column will be lost.
  - You are about to drop the column `late_fee_percentage` on the `bills` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bills" DROP COLUMN "late_fee_max_percentage",
DROP COLUMN "late_fee_percentage";

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "created_by_owner_id" TEXT;
