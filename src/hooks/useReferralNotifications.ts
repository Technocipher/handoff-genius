import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

type ReferralStatus = 'pending' | 'accepted' | 'in_treatment' | 'completed' | 'rejected' | 'more_info_requested';

const statusLabels: Record<ReferralStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  in_treatment: 'In Treatment',
  completed: 'Completed',
  rejected: 'Rejected',
  more_info_requested: 'More Info Requested',
};

export const useReferralNotifications = () => {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('referral-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'referrals',
        },
        (payload) => {
          const oldStatus = payload.old?.status as ReferralStatus;
          const newStatus = payload.new?.status as ReferralStatus;
          const patientName = payload.new?.patient_name;
          const fromHospitalId = payload.new?.from_hospital_id;
          const toHospitalId = payload.new?.to_hospital_id;

          // Only show notification if status changed
          if (oldStatus !== newStatus) {
            const isAdmin = currentUser.role === 'admin';
            const isFromMyHospital = fromHospitalId === currentUser.hospital_id;
            const isToMyHospital = toHospitalId === currentUser.hospital_id;

            // Show notification only for relevant users
            if (isAdmin || isFromMyHospital || isToMyHospital) {
              const statusLabel = statusLabels[newStatus] || newStatus;
              
              toast.info(`Referral Updated`, {
                description: `${patientName}'s referral status changed to "${statusLabel}"`,
                duration: 5000,
              });

              // Invalidate referrals query to refresh data
              queryClient.invalidateQueries({ queryKey: ['referrals'] });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'referrals',
        },
        (payload) => {
          const toHospitalId = payload.new?.to_hospital_id;
          const patientName = payload.new?.patient_name;
          const isAdmin = currentUser.role === 'admin';
          const isToMyHospital = toHospitalId === currentUser.hospital_id;

          // Notify receiving hospital about new referral
          if (isAdmin || isToMyHospital) {
            toast.info(`New Referral Received`, {
              description: `New referral for patient ${patientName}`,
              duration: 5000,
            });

            queryClient.invalidateQueries({ queryKey: ['referrals'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, queryClient]);
};
