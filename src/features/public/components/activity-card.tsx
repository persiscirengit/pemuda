import { Calendar, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Activity } from "@/db/schema/activities";

export interface ActivityCardProps {
  activity: Activity;
}

export function ActivityCard({ activity }: ActivityCardProps) {
  const formattedTime =
    activity.startTime && activity.endTime
      ? `${activity.startTime} - ${activity.endTime}`
      : activity.startTime || null;

  return (
    <Card className="border-border/80 transition-shadow hover:shadow-md">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="secondary" className="font-medium">
            <Calendar className="mr-1 h-3 w-3" />
            <span>{activity.activityDate}</span>
          </Badge>
          {formattedTime && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formattedTime}</span>
            </span>
          )}
        </div>
        <CardTitle className="pt-2 text-base font-semibold leading-snug">
          {activity.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-5 pb-5 pt-0 space-y-2">
        {activity.topic && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {activity.topic}
          </p>
        )}
        {activity.location && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{activity.location}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
