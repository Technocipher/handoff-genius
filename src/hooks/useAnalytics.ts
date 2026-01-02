import { useMemo } from 'react';
import { Referral } from '@/types/referral';
import { differenceInHours, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, format, subMonths } from 'date-fns';

interface AnalyticsData {
  // Overview metrics
  totalReferrals: number;
  successRate: number;
  averageResponseTimeHours: number;
  rejectionRate: number;
  
  // Trends
  referralsByDate: { date: string; count: number }[];
  referralsByStatus: { status: string; count: number; fill: string }[];
  referralsByUrgency: { urgency: string; count: number; fill: string }[];
  
  // Hospital performance
  hospitalPerformance: {
    hospital: string;
    sent: number;
    received: number;
    avgResponseTime: number;
  }[];
  
  // Top referral reasons
  topReasons: { reason: string; count: number }[];
  
  // Personal metrics
  personalMetrics: {
    referralsCreated: number;
    referralsCompleted: number;
    averageCompletionDays: number;
    pendingReferrals: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'hsl(38, 92%, 50%)',
  accepted: 'hsl(199, 89%, 48%)',
  in_treatment: 'hsl(192, 91%, 36%)',
  completed: 'hsl(142, 76%, 36%)',
  rejected: 'hsl(0, 84%, 60%)',
  more_info_requested: 'hsl(215, 16%, 47%)',
};

const URGENCY_COLORS: Record<string, string> = {
  emergency: 'hsl(0, 84%, 60%)',
  urgent: 'hsl(38, 92%, 50%)',
  routine: 'hsl(142, 76%, 36%)',
};

export const useAnalytics = (referrals: Referral[], userId?: string): AnalyticsData => {
  return useMemo(() => {
    if (!referrals.length) {
      return {
        totalReferrals: 0,
        successRate: 0,
        averageResponseTimeHours: 0,
        rejectionRate: 0,
        referralsByDate: [],
        referralsByStatus: [],
        referralsByUrgency: [],
        hospitalPerformance: [],
        topReasons: [],
        personalMetrics: {
          referralsCreated: 0,
          referralsCompleted: 0,
          averageCompletionDays: 0,
          pendingReferrals: 0,
        },
      };
    }

    // Calculate success rate
    const completedCount = referrals.filter(r => r.status === 'completed').length;
    const rejectedCount = referrals.filter(r => r.status === 'rejected').length;
    const successRate = referrals.length > 0 ? (completedCount / referrals.length) * 100 : 0;
    const rejectionRate = referrals.length > 0 ? (rejectedCount / referrals.length) * 100 : 0;

    // Calculate average response time (time to first status change)
    const responseTimes = referrals
      .filter(r => r.activityLog && r.activityLog.length > 1)
      .map(r => {
        const firstAction = r.activityLog.find(log => 
          log.action !== 'Referral Created' && log.action !== 'created'
        );
        if (firstAction) {
          return differenceInHours(new Date(firstAction.timestamp), new Date(r.createdAt));
        }
        return null;
      })
      .filter((t): t is number => t !== null);
    
    const averageResponseTimeHours = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // Referrals by date (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = subMonths(now, 1);
    const dateRange = eachDayOfInterval({ start: thirtyDaysAgo, end: now });
    
    const referralsByDate = dateRange.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const count = referrals.filter(r => 
        format(new Date(r.createdAt), 'yyyy-MM-dd') === dateStr
      ).length;
      return { date: format(date, 'MMM dd'), count };
    });

    // Referrals by status
    const statusCounts: Record<string, number> = {};
    referrals.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });
    const referralsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status: status.replace('_', ' '),
      count,
      fill: STATUS_COLORS[status] || 'hsl(215, 16%, 47%)',
    }));

    // Referrals by urgency
    const urgencyCounts: Record<string, number> = {};
    referrals.forEach(r => {
      urgencyCounts[r.urgency] = (urgencyCounts[r.urgency] || 0) + 1;
    });
    const referralsByUrgency = Object.entries(urgencyCounts).map(([urgency, count]) => ({
      urgency,
      count,
      fill: URGENCY_COLORS[urgency] || 'hsl(215, 16%, 47%)',
    }));

    // Hospital performance
    const hospitalStats: Record<string, { sent: number; received: number; responseTimes: number[] }> = {};
    
    referrals.forEach(r => {
      // Track sent referrals
      if (!hospitalStats[r.fromHospitalName]) {
        hospitalStats[r.fromHospitalName] = { sent: 0, received: 0, responseTimes: [] };
      }
      hospitalStats[r.fromHospitalName].sent++;

      // Track received referrals
      if (!hospitalStats[r.toHospitalName]) {
        hospitalStats[r.toHospitalName] = { sent: 0, received: 0, responseTimes: [] };
      }
      hospitalStats[r.toHospitalName].received++;

      // Track response times for receiving hospital
      if (r.activityLog && r.activityLog.length > 1) {
        const firstAction = r.activityLog.find(log => 
          log.action !== 'Referral Created' && log.action !== 'created'
        );
        if (firstAction) {
          const responseTime = differenceInHours(new Date(firstAction.timestamp), new Date(r.createdAt));
          hospitalStats[r.toHospitalName].responseTimes.push(responseTime);
        }
      }
    });

    const hospitalPerformance = Object.entries(hospitalStats)
      .map(([hospital, stats]) => ({
        hospital: hospital.length > 20 ? hospital.substring(0, 20) + '...' : hospital,
        sent: stats.sent,
        received: stats.received,
        avgResponseTime: stats.responseTimes.length > 0
          ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)
          : 0,
      }))
      .sort((a, b) => (b.sent + b.received) - (a.sent + a.received))
      .slice(0, 5);

    // Top referral reasons
    const reasonCounts: Record<string, number> = {};
    referrals.forEach(r => {
      const reason = r.reasonForReferral.substring(0, 50);
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    const topReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Personal metrics
    const userReferrals = userId 
      ? referrals.filter(r => r.fromDoctorId === userId)
      : referrals;
    
    const completedUserReferrals = userReferrals.filter(r => r.status === 'completed');
    const completionDays = completedUserReferrals
      .filter(r => r.completedAt)
      .map(r => differenceInDays(new Date(r.completedAt!), new Date(r.createdAt)));
    
    const personalMetrics = {
      referralsCreated: userReferrals.length,
      referralsCompleted: completedUserReferrals.length,
      averageCompletionDays: completionDays.length > 0
        ? Math.round(completionDays.reduce((a, b) => a + b, 0) / completionDays.length)
        : 0,
      pendingReferrals: userReferrals.filter(r => r.status === 'pending').length,
    };

    return {
      totalReferrals: referrals.length,
      successRate: Math.round(successRate * 10) / 10,
      averageResponseTimeHours: Math.round(averageResponseTimeHours),
      rejectionRate: Math.round(rejectionRate * 10) / 10,
      referralsByDate,
      referralsByStatus,
      referralsByUrgency,
      hospitalPerformance,
      topReasons,
      personalMetrics,
    };
  }, [referrals, userId]);
};
