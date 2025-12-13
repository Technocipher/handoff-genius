import { useReferralNotifications } from '@/hooks/useReferralNotifications';

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  useReferralNotifications();
  return <>{children}</>;
};
