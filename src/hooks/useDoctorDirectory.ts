import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DoctorProfile {
  id: string;
  full_name: string;
  email: string;
  specialty: string | null;
  hospital_id: string | null;
  hospital_name: string | null;
  bio: string | null;
  phone: string | null;
  preferred_referral_method: string | null;
  availability_status: string | null;
  years_experience: number | null;
  average_rating: number;
  review_count: number;
}

interface Filters {
  search: string;
  specialty: string;
  hospital: string;
  availability: string;
}

export const useDoctorDirectory = () => {
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    specialty: '',
    hospital: '',
    availability: '',
  });
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [hospitals, setHospitals] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchDoctors = async () => {
      setLoading(true);
      
      // Fetch all profiles with hospital info
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          specialty,
          hospital_id,
          bio,
          phone,
          preferred_referral_method,
          availability_status,
          years_experience,
          hospitals (name)
        `);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        setLoading(false);
        return;
      }

      // Fetch all reviews
      const { data: reviews, error: reviewsError } = await supabase
        .from('doctor_reviews')
        .select('doctor_id, rating');

      if (reviewsError) {
        console.error('Error fetching reviews:', reviewsError);
      }

      // Calculate average ratings
      const ratingsByDoctor: Record<string, { total: number; count: number }> = {};
      reviews?.forEach(review => {
        if (!ratingsByDoctor[review.doctor_id]) {
          ratingsByDoctor[review.doctor_id] = { total: 0, count: 0 };
        }
        ratingsByDoctor[review.doctor_id].total += review.rating;
        ratingsByDoctor[review.doctor_id].count++;
      });

      // Map profiles with ratings
      const doctorsWithRatings: DoctorProfile[] = (profiles || []).map(profile => ({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        specialty: profile.specialty,
        hospital_id: profile.hospital_id,
        hospital_name: (profile.hospitals as any)?.name || null,
        bio: profile.bio,
        phone: profile.phone,
        preferred_referral_method: profile.preferred_referral_method,
        availability_status: profile.availability_status || 'available',
        years_experience: profile.years_experience,
        average_rating: ratingsByDoctor[profile.id]
          ? Math.round((ratingsByDoctor[profile.id].total / ratingsByDoctor[profile.id].count) * 10) / 10
          : 0,
        review_count: ratingsByDoctor[profile.id]?.count || 0,
      }));

      setDoctors(doctorsWithRatings);

      // Extract unique specialties
      const uniqueSpecialties = [...new Set(
        doctorsWithRatings
          .map(d => d.specialty)
          .filter((s): s is string => !!s)
      )].sort();
      setSpecialties(uniqueSpecialties);

      setLoading(false);
    };

    const fetchHospitals = async () => {
      const { data, error } = await supabase
        .from('hospitals')
        .select('id, name')
        .order('name');
      
      if (!error && data) {
        setHospitals(data);
      }
    };

    fetchDoctors();
    fetchHospitals();
  }, []);

  const filteredDoctors = useMemo(() => {
    return doctors.filter(doctor => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          doctor.full_name.toLowerCase().includes(searchLower) ||
          doctor.specialty?.toLowerCase().includes(searchLower) ||
          doctor.hospital_name?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Specialty filter
      if (filters.specialty && doctor.specialty !== filters.specialty) {
        return false;
      }

      // Hospital filter
      if (filters.hospital && doctor.hospital_id !== filters.hospital) {
        return false;
      }

      // Availability filter
      if (filters.availability && doctor.availability_status !== filters.availability) {
        return false;
      }

      return true;
    });
  }, [doctors, filters]);

  const updateFilters = (newFilters: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      specialty: '',
      hospital: '',
      availability: '',
    });
  };

  return {
    doctors: filteredDoctors,
    allDoctors: doctors,
    loading,
    filters,
    updateFilters,
    clearFilters,
    specialties,
    hospitals,
  };
};
