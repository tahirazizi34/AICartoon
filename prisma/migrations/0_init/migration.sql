-- prisma/migrations/0_init/migration.sql
-- CreateEnum
CREATE TYPE "EpisodeStatus" AS ENUM ('QUEUED', 'SCRIPTING', 'VOICING', 'RENDERING', 'ASSEMBLING', 'UPLOADING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "studioName" TEXT NOT NULL DEFAULT 'My Studio',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "status" "EpisodeStatus" NOT NULL DEFAULT 'QUEUED',
    "audioPath" TEXT,
    "videoPath" TEXT,
    "thumbnailPath" TEXT,
    "youtubeVideoId" TEXT,
    "youtubeUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "generationLog" TEXT,
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "episodesPerDay" INTEGER NOT NULL DEFAULT 10,
    "episodeDuration" INTEGER NOT NULL DEFAULT 120,
    "artStyle" TEXT NOT NULL DEFAULT '2D Cartoon',
    "genre" TEXT NOT NULL DEFAULT 'Comedy Adventure',
    "characterNames" TEXT NOT NULL DEFAULT '',
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scheduleSlots" TEXT NOT NULL DEFAULT '06:00,08:00,10:00,12:00,14:00,16:00,18:00,20:00,22:00,23:00',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "autoPublish" BOOLEAN NOT NULL DEFAULT true,
    "defaultVisibility" TEXT NOT NULL DEFAULT 'public',
    "addToPlaylist" BOOLEAN NOT NULL DEFAULT true,
    "playlistId" TEXT,
    "autoCaptions" BOOLEAN NOT NULL DEFAULT false,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "anthropicKey" TEXT,
    "replicateKey" TEXT,
    "elevenLabsKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "studio_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "youtube_auth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "channelHandle" TEXT,
    "subscriberCount" INTEGER,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "youtube_auth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "studio_settings_userId_key" ON "studio_settings"("userId");
CREATE UNIQUE INDEX "youtube_auth_userId_key" ON "youtube_auth"("userId");
CREATE INDEX "episodes_userId_idx" ON "episodes"("userId");
CREATE INDEX "episodes_status_idx" ON "episodes"("status");
CREATE INDEX "episodes_createdAt_idx" ON "episodes"("createdAt");

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "studio_settings" ADD CONSTRAINT "studio_settings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "youtube_auth" ADD CONSTRAINT "youtube_auth_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
