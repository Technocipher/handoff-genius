import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import DoctorCard from '@/components/DoctorCard';
import DoctorProfileDialog from '@/components/DoctorProfileDialog';
import { useDoctorDirectory, DoctorProfile } from '@/hooks/useDoctorDirectory';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, X, Users, Filter } from 'lucide-react';

const DoctorDirectory = () => {
  const navigate = useNavigate();
  const {
    doctors,
    loading,
    filters,
    updateFilters,
    clearFilters,
    specialties,
    hospitals,
  } = useDoctorDirectory();

  const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleViewProfile = (doctor: DoctorProfile) => {
    setSelectedDoctor(doctor);
    setProfileOpen(true);
  };

  const handleStartReferral = (doctor: DoctorProfile) => {
    navigate('/create-referral', { 
      state: { 
        preselectedHospital: doctor.hospital_id,
        preselectedDoctor: doctor.id 
      } 
    });
  };

  const hasActiveFilters = filters.search || filters.specialty || filters.hospital || filters.availability;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-32 mb-2" />
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Doctor Directory</h1>
          <p className="text-muted-foreground">
            Find specialists by specialty, hospital, or availability
          </p>
        </div>

        {/* Filters */}
        <Card className="card-elevated mb-8">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, specialty, or hospital..."
                  value={filters.search}
                  onChange={(e) => updateFilters({ search: e.target.value })}
                  className="pl-10"
                />
              </div>

              {/* Specialty Filter */}
              <Select
                value={filters.specialty}
                onValueChange={(value) => updateFilters({ specialty: value === 'all' ? '' : value })}
              >
                <SelectTrigger className="w-full lg:w-[200px]">
                  <SelectValue placeholder="All Specialties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Specialties</SelectItem>
                  {specialties.map((specialty) => (
                    <SelectItem key={specialty} value={specialty}>
                      {specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Hospital Filter */}
              <Select
                value={filters.hospital}
                onValueChange={(value) => updateFilters({ hospital: value === 'all' ? '' : value })}
              >
                <SelectTrigger className="w-full lg:w-[200px]">
                  <SelectValue placeholder="All Hospitals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Hospitals</SelectItem>
                  {hospitals.map((hospital) => (
                    <SelectItem key={hospital.id} value={hospital.id}>
                      {hospital.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Availability Filter */}
              <Select
                value={filters.availability}
                onValueChange={(value) => updateFilters({ availability: value === 'all' ? '' : value })}
              >
                <SelectTrigger className="w-full lg:w-[160px]">
                  <SelectValue placeholder="Availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="away">Away</SelectItem>
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFilters}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Showing {doctors.length} doctor{doctors.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {doctors.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No doctors found
              </h3>
              <p className="text-muted-foreground mb-4">
                {hasActiveFilters
                  ? 'Try adjusting your filters to see more results'
                  : 'No doctors are registered in the system yet'}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.map((doctor) => (
              <DoctorCard
                key={doctor.id}
                doctor={doctor}
                onViewProfile={handleViewProfile}
                onStartReferral={handleStartReferral}
              />
            ))}
          </div>
        )}

        {/* Doctor Profile Dialog */}
        <DoctorProfileDialog
          doctor={selectedDoctor}
          open={profileOpen}
          onOpenChange={setProfileOpen}
          onStartReferral={handleStartReferral}
        />
      </main>
    </div>
  );
};

export default DoctorDirectory;
