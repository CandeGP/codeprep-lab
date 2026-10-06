-- AlterTable
ALTER TABLE "Domain" ADD COLUMN "nameEn" TEXT;

-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN "backEs" TEXT;
ALTER TABLE "Flashcard" ADD COLUMN "frontEs" TEXT;

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN "nameEn" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SINGLE',
    "stem" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correct" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "optionNotes" TEXT NOT NULL DEFAULT '[]',
    "stemEs" TEXT,
    "optionsEs" TEXT,
    "explanationEs" TEXT,
    "optionNotesEs" TEXT,
    "sources" TEXT NOT NULL DEFAULT '[]',
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "source" TEXT NOT NULL DEFAULT 'CURATED',
    "stemHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reports" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Question_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("correct", "courseId", "createdAt", "difficulty", "domainId", "explanation", "id", "optionNotes", "options", "reports", "source", "status", "stem", "stemHash", "type", "updatedAt") SELECT "correct", "courseId", "createdAt", "difficulty", "domainId", "explanation", "id", "optionNotes", "options", "reports", "source", "status", "stem", "stemHash", "type", "updatedAt" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE INDEX "Question_courseId_status_idx" ON "Question"("courseId", "status");
CREATE UNIQUE INDEX "Question_courseId_stemHash_key" ON "Question"("courseId", "stemHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
