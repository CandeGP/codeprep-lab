-- CreateTable
CREATE TABLE "PdfBlob" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "data" BLOB NOT NULL,
    CONSTRAINT "PdfBlob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PdfFile" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lesson" (
    "slug" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL DEFAULT 999,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "markdown" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LessonQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonSlug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    CONSTRAINT "LessonQuestion_lessonSlug_fkey" FOREIGN KEY ("lessonSlug") REFERENCES "Lesson" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonSlug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    CONSTRAINT "Problem_lessonSlug_fkey" FOREIGN KEY ("lessonSlug") REFERENCES "Lesson" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LessonQuestion_lessonSlug_order_idx" ON "LessonQuestion"("lessonSlug", "order");

-- CreateIndex
CREATE INDEX "Problem_lessonSlug_order_idx" ON "Problem"("lessonSlug", "order");
