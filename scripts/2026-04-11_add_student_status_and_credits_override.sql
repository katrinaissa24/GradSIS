-- Migration: 2026-04-11
-- Adds:
--   1. user_semesters.student_status  : freshman | sophomore | junior | senior (nullable)
--   2. user_courses.credits           : per-user credit override for a course (nullable)
--
-- Run this against your Supabase Postgres database.

ALTER TABLE user_semesters
  ADD COLUMN IF NOT EXISTS student_status TEXT;

ALTER TABLE user_courses
  ADD COLUMN IF NOT EXISTS credits NUMERIC;
