-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "githubUsername" TEXT NOT NULL,
    "githubUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Previews" (
    "id" SERIAL NOT NULL,
    "repo" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "Previews_pkey" PRIMARY KEY ("id")
);
