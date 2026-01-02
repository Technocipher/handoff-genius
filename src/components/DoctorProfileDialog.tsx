import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Star, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  MessageSquare,
  Send
} from 'lucide-react';
import { DoctorProfile } from '@/hooks/useDoctorDirectory';
import { useDoctorReviews } from '@/hooks/useDoctorReviews';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DoctorProfileDialogProps {
  doctor: DoctorProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartReferral?: (doctor: DoctorProfile) => void;
}

const availabilityStyles: Record<string, { label: string; className: string }> = {
  available: { label: 'Available', className: 'bg-success/10 text-success border-success/20' },
  busy: { label: 'Busy', className: 'bg-warning/10 text-warning border-warning/20' },
  away: { label: 'Away', className: 'bg-muted text-muted-foreground border-border' },
};

const preferredMethodLabels: Record<string, string> = {
  'in-app': 'In-App Message',
  'email': 'Email',
  'phone': 'Phone Call',
};

const DoctorProfileDialog = ({ 
  doctor, 
  open, 
  onOpenChange,
  onStartReferral 
}: DoctorProfileDialogProps) => {
  const { reviews, loading: reviewsLoading } = useDoctorReviews(doctor?.id || '');

  if (!doctor) return null;

  const initials = doctor.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const availability = availabilityStyles[doctor.availability_status || 'available'] || availabilityStyles.available;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="sr-only">Doctor Profile</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[75vh] pr-4">
          {/* Header */}
          <div className="flex items-start gap-4 pb-4">
            <Avatar className="h-20 w-20 ring-2 ring-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    {doctor.full_name}
                  </h2>
                  <p className="text-primary font-medium">
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
                      'h-5 w-5',
                      star <= Math.round(doctor.average_rating)
                        ? 'fill-warning text-warning'
                        : 'text-muted-foreground/30'
                    )}
                  />
                ))}
                <span className="text-muted-foreground ml-2">
                  {doctor.average_rating > 0 ? doctor.average_rating : 'No ratings yet'}
                  {doctor.review_count > 0 && (
                    <span> ({doctor.review_count} reviews)</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Contact & Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Contact Information</h3>
              <div className="space-y-3">
                {doctor.hospital_name && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>{doctor.hospital_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="h-4 w-4 text-primary" />
                  <a href={`mailto:${doctor.email}`} className="hover:text-primary transition-colors">
                    {doctor.email}
                  </a>
                </div>
                {doctor.phone && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Phone className="h-4 w-4 text-primary" />
                    <a href={`tel:${doctor.phone}`} className="hover:text-primary transition-colors">
                      {doctor.phone}
                    </a>
                  </div>
                )}
                {doctor.preferred_referral_method && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span>
                      Preferred: {preferredMethodLabels[doctor.preferred_referral_method] || doctor.preferred_referral_method}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Experience</h3>
              <div className="space-y-3">
                {doctor.years_experience && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{doctor.years_experience} years of experience</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {doctor.bio && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">About</h3>
                <p className="text-muted-foreground leading-relaxed">{doctor.bio}</p>
              </div>
            </>
          )}

          {/* Reviews */}
          <Separator className="my-4" />
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">
              Reviews ({reviews.length})
            </h3>
            
            {reviewsLoading ? (
              <p className="text-muted-foreground text-sm">Loading reviews...</p>
            ) : reviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">No reviews yet</p>
            ) : (
              <div className="space-y-4">
                {reviews.slice(0, 5).map((review) => (
                  <div key={review.id} className="p-4 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-foreground">
                        {review.reviewer_name}
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={cn(
                              'h-3.5 w-3.5',
                              star <= review.rating
                                ? 'fill-warning text-warning'
                                : 'text-muted-foreground/30'
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground">{review.comment}</p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      {format(new Date(review.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            {onStartReferral && doctor.availability_status !== 'away' && (
              <Button onClick={() => onStartReferral(doctor)} className="flex-1">
                <Send className="h-4 w-4 mr-2" />
                Start Referral
              </Button>
            )}
            <Button variant="outline" asChild>
              <a href={`mailto:${doctor.email}`}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </a>
            </Button>
            {doctor.phone && (
              <Button variant="outline" asChild>
                <a href={`tel:${doctor.phone}`}>
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </a>
              </Button>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default DoctorProfileDialog;
