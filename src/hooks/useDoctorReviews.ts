import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DoctorReview {
  id: string;
  doctor_id: string;
  reviewer_id: string;
  referral_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name?: string;
}

export const useDoctorReviews = (doctorId: string) => {
  const [reviews, setReviews] = useState<DoctorReview[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchReviews = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('doctor_reviews')
      .select(`
        id,
        doctor_id,
        reviewer_id,
        referral_id,
        rating,
        comment,
        created_at
      `)
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      setLoading(false);
      return;
    }

    // Fetch reviewer names
    const reviewerIds = [...new Set(data?.map(r => r.reviewer_id) || [])];
    const { data: reviewers } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', reviewerIds);

    const reviewerMap = new Map(reviewers?.map(r => [r.id, r.full_name]) || []);

    const reviewsWithNames: DoctorReview[] = (data || []).map(review => ({
      ...review,
      reviewer_name: reviewerMap.get(review.reviewer_id) || 'Anonymous',
    }));

    setReviews(reviewsWithNames);
    setLoading(false);
  };

  useEffect(() => {
    if (doctorId) {
      fetchReviews();
    }
  }, [doctorId]);

  const addReview = async (
    referralId: string,
    rating: number,
    comment?: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to leave a review',
        variant: 'destructive',
      });
      return false;
    }

    const { error } = await supabase
      .from('doctor_reviews')
      .insert({
        doctor_id: doctorId,
        reviewer_id: user.id,
        referral_id: referralId,
        rating,
        comment: comment || null,
      });

    if (error) {
      console.error('Error adding review:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Review submitted',
      description: 'Thank you for your feedback!',
    });

    await fetchReviews();
    return true;
  };

  const averageRating = reviews.length > 0
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  return {
    reviews,
    loading,
    addReview,
    averageRating,
    reviewCount: reviews.length,
    refetch: fetchReviews,
  };
};
