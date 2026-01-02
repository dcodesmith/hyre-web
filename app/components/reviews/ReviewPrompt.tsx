import { MessageSquare, Star } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { ReviewForm } from "./ReviewForm";

interface ReviewPromptProps {
  readonly bookingId: string;
  readonly onReviewSubmitted?: () => void;
  readonly className?: string;
}

export function ReviewPrompt({ bookingId, onReviewSubmitted, className }: ReviewPromptProps) {
  const [showForm, setShowForm] = useState(false);

  const handleReviewSubmitted = () => {
    setShowForm(false);
    onReviewSubmitted?.();
  };

  if (showForm) {
    return (
      <div className={className}>
        <ReviewForm
          bookingId={bookingId}
          onSuccess={handleReviewSubmitted}
          onCancel={() => setShowForm(false)}
          inModal={false}
        />
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-lg">
            <Star className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <CardTitle>Share Your Experience</CardTitle>
            <CardDescription>Help others by leaving a review</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Your feedback helps us improve and helps other customers make informed decisions. It
            only takes a minute!
          </p>
          <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
            <MessageSquare className="h-4 w-4 mr-2" />
            Write a Review
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
