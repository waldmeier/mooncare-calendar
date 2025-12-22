-- CreateTable
CREATE TABLE "DayEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "zodiac" TEXT NOT NULL DEFAULT 'OTHER',
    "phase" TEXT NOT NULL DEFAULT 'OTHER',
    "hnw" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "DayEntry_date_key" ON "DayEntry"("date");
