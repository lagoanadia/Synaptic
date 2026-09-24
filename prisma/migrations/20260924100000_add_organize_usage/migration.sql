-- CreateTable
CREATE TABLE "OrganizeUsage" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,

    CONSTRAINT "OrganizeUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizeUsage_userId_date_key" ON "OrganizeUsage"("userId", "date");

-- AddForeignKey
ALTER TABLE "OrganizeUsage" ADD CONSTRAINT "OrganizeUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
