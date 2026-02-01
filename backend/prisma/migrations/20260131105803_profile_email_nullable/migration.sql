/*
  Warnings:

  - You are about to drop the column `password` on the `profiles` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `profiles` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "profiles_email_key";

-- AlterTable
ALTER TABLE "profiles" DROP COLUMN "password",
DROP COLUMN "updatedAt",
ALTER COLUMN "email" DROP NOT NULL;
