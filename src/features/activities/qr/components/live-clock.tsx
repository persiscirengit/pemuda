"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";

export function LiveClock() {
  const t = useTranslations("attendance.qr");
  const [timeStr, setTimeStr] = React.useState<string>("");

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="secondary"
        className="flex items-center gap-1.5 px-3 py-1 font-mono text-sm shadow-xs"
      >
        <Clock className="size-4 text-primary" />
        <span className="text-muted-foreground">{t("liveClockTitle")}</span>
        <span className="font-bold text-foreground">
          {timeStr || "--:--:--"}
        </span>
      </Badge>
    </div>
  );
}
