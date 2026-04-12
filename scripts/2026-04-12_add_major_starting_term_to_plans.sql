-- Add major_id and starting_term_id to plans table
-- This associates each plan (Plan A, Plan B) with a specific major and starting term

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS major_id uuid REFERENCES public.majors(id),
  ADD COLUMN IF NOT EXISTS starting_term_id uuid REFERENCES public.starting_terms(id);

-- Optional: create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_plans_major_id ON public.plans(major_id);
CREATE INDEX IF NOT EXISTS idx_plans_starting_term_id ON public.plans(starting_term_id);
