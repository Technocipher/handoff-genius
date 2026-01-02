import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star, Phone, Mail, MapPin, Clock } from 'lucide-react';
import { DoctorProfile } from '@/hooks/useDoctorDirectory';
import { cn } from '@/lib/utils';

interface DoctorCardProps {
  doctor: DoctorProfile;
  onViewProfile: (doctor: DoctorProfile) => void;
  onStartReferral?: (doctor: DoctorProfile) => void;
}

const availabilityStyles: Record<string, { label: string; className: string }> = {
  available: { label: 'Available', className: 'bg-success/10 text-success border-success/20' },
  busy: { label: 'Busy', className: 'bg-warning/10 text-warning border-warning/20' },
  away: { label: 'Away', className: 'bg-muted text-muted-foreground border-border' },
};

const DoctorCard = ({ doctor, onViewProfile, onStartReferral }: DoctorCardProps) => {
  const initials = doctor.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const availability = availabilityStyles[doctor.availability_status || 'available'] || availabilityStyles.available;

  return (
    <Card className="card-elevated hover:shadow-lg transition-all duration-300 group">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-border group-hover:ring-primary/20 transition-all">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground text-lg truncate">
                  {doctor.full_name}
                </h3>
                <p className="text-primary font-medium text-sm">
                  {doctor.specialty || 'General Practice'}
                </p>
              </div>
              <Badge 
                variant="outline" 
                className={cn('shrink-0', availability.className)}
              >
                {availability.label}
              </Badge>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    'h-4 w-4',
                    star <= Math.round(doctor.average_rating)
                      ? 'fill-warning text-warning'
                      : 'text-muted-foreground/30'
                  )}
                />
              ))}
              <span className="text-sm text-muted-foreground ml-1">
                {doctor.average_rating > 0 ? doctor.average_rating : 'No ratings'}
                {doctor.review_count > 0 && (
                  <span className="ml-1">({doctor.review_count} reviews)</span>
                )}
              </span>
            </div>

            {/* Info */}
            <div className="mt-3 space-y-1.5">
              {doctor.hospital_name && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate">{doctor.hospital_name}</span>
                </div>
              )}
              {doctor.years_experience && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{doctor.years_experience} years experience</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onViewProfile(doctor)}
              >
                View Profile
              </Button>
              {onStartReferral && doctor.availability_status !== 'away' && (
                <Button 
                  size="sm"
                  onClick={() => onStartReferral(doctor)}
                >
                  Start Referral
                </Button>
              )}
              {doctor.phone && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  asChild
                >
                  <a href={`tel:${doctor.phone}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                asChild
              >
                <a href={`mailto:${doctor.email}`}>
                  <Mail className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DoctorCard;
