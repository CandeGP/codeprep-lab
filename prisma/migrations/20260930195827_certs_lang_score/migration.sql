-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "examQuestions" INTEGER NOT NULL DEFAULT 65,
    "simQuestions" INTEGER NOT NULL DEFAULT 60,
    "timeLimitMin" INTEGER NOT NULL DEFAULT 90,
    "passingPct" INTEGER NOT NULL DEFAULT 70,
    "passingScore" INTEGER NOT NULL DEFAULT 700,
    "source" TEXT NOT NULL DEFAULT 'CURATED',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Course" ("code", "createdAt", "createdById", "description", "examQuestions", "id", "passingPct", "provider", "simQuestions", "slug", "source", "timeLimitMin", "title") SELECT "code", "createdAt", "createdById", "description", "examQuestions", "id", "passingPct", "provider", "simQuestions", "slug", "source", "timeLimitMin", "title" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "id", "passwordHash", "username") SELECT "createdAt", "id", "passwordHash", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
