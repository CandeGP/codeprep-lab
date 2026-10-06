-- CreateTable
CREATE TABLE "Course" (
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
    "source" TEXT NOT NULL DEFAULT 'CURATED',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Domain_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Topic_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SINGLE',
    "stem" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correct" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "optionNotes" TEXT NOT NULL DEFAULT '[]',
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

-- CreateTable
CREATE TABLE "QuestionTopic" (
    "questionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    PRIMARY KEY ("questionId", "topicId"),
    CONSTRAINT "QuestionTopic_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Flashcard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "topicId" TEXT,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CURATED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Flashcard_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Flashcard_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filters" TEXT NOT NULL DEFAULT '{}',
    "questionIds" TEXT NOT NULL,
    "timeLimitSec" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "score" REAL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamAttempt_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttemptAnswer" (
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selected" TEXT NOT NULL DEFAULT '[]',
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "timeMs" INTEGER NOT NULL DEFAULT 0,
    "answeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("attemptId", "questionId"),
    CONSTRAINT "AttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionMark" (
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "questionId"),
    CONSTRAINT "QuestionMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyCard" (
    "userId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "ease" REAL NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "dueAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastResult" BOOLEAN,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "itemType", "itemId"),
    CONSTRAINT "StudyCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topics" TEXT NOT NULL DEFAULT '[]',
    "target" INTEGER NOT NULL,
    "done" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GenerationJob_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_courseId_slug_key" ON "Domain"("courseId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_courseId_slug_key" ON "Topic"("courseId", "slug");

-- CreateIndex
CREATE INDEX "Question_courseId_status_idx" ON "Question"("courseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Question_courseId_stemHash_key" ON "Question"("courseId", "stemHash");

-- CreateIndex
CREATE INDEX "QuestionTopic_topicId_idx" ON "QuestionTopic"("topicId");

-- CreateIndex
CREATE INDEX "Flashcard_courseId_idx" ON "Flashcard"("courseId");

-- CreateIndex
CREATE INDEX "ExamAttempt_userId_courseId_startedAt_idx" ON "ExamAttempt"("userId", "courseId", "startedAt");

-- CreateIndex
CREATE INDEX "AttemptAnswer_questionId_idx" ON "AttemptAnswer"("questionId");

-- CreateIndex
CREATE INDEX "QuestionMark_userId_courseId_idx" ON "QuestionMark"("userId", "courseId");

-- CreateIndex
CREATE INDEX "StudyCard_userId_dueAt_idx" ON "StudyCard"("userId", "dueAt");
