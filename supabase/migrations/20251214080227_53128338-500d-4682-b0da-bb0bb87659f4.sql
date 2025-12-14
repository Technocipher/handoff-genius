-- Create table for storing push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can view own subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own subscriptions"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own subscriptions"
ON public.push_subscriptions
FOR DELETE
USING (user_id = auth.uid());

-- Admins can view all subscriptions (for sending notifications)
CREATE POLICY "Service role can view all subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));