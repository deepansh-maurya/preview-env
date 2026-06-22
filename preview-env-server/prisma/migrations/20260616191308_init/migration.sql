/*
  Warnings:

  - Changed the type of `githubUserId` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "githubUserId",
ADD COLUMN     "githubUserId" INTEGER NOT NULL;
