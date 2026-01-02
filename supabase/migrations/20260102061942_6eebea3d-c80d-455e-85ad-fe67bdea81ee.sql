-- Add new columns to profiles for doctor directory
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_referral_method text DEFAULT 'in-app';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability_status text DEFAULT 'available';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS years_experience integer;

-- Create doctor_reviews table
CREATE TABLE IF NOT EXISTS public.doctor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  rating integer NOT NULL,
  comment text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT rating_range CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT unique_referral_review UNIQUE(referral_id, reviewer_id)
);

-- Enable RLS on doctor_reviews
ALTER TABLE public.doctor_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for doctor_reviews
CREATE POLICY "Anyone can view reviews" ON public.doctor_reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can create reviews for completed referrals" ON public.doctor_reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.referrals r
      WHERE r.id = referral_id
      AND r.created_by = auth.uid()
      AND r.status = 'completed'
    )
  );

CREATE POLICY "Users can update their own reviews" ON public.doctor_reviews
  FOR UPDATE USING (reviewer_id = auth.uid());

CREATE POLICY "Users can delete their own reviews" ON public.doctor_reviews
  FOR DELETE USING (reviewer_id = auth.uid());