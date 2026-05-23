-- Add missing columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT;

-- Add missing columns to posts table
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "images" TEXT;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "video_url" TEXT;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "tags" TEXT;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "emojis" TEXT;
