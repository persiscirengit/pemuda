"use client";

import { Check, CheckCheck, ExternalLink, Inbox, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Notification } from "@/db/schema/notifications";
import {
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from "@/features/notifications/actions";

export interface NotificationsFeedProps {
  initialNotifications: Notification[];
}

export function NotificationsFeed({
  initialNotifications,
}: NotificationsFeedProps) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [notificationsList, setNotificationsList] =
    useState<Notification[]>(initialNotifications);
  const [isPending, startTransition] = useTransition();

  const filteredNotifications =
    activeTab === "unread"
      ? notificationsList.filter((n) => !n.readAt)
      : notificationsList;

  const unreadCount = notificationsList.filter((n) => !n.readAt).length;

  const handleMarkAllRead = () => {
    startTransition(async () => {
      setNotificationsList((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date() })),
      );
      await markAllNotificationsAsReadAction();
      router.refresh();
    });
  };

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      setNotificationsList((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)),
      );
      await markNotificationAsReadAction({ id });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("all")}
          >
            <span>{t("tabs.all")}</span>
            <Badge variant="secondary" className="ml-2 font-normal">
              <span>{notificationsList.length}</span>
            </Badge>
          </Button>

          <Button
            variant={activeTab === "unread" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("unread")}
          >
            <span>{t("tabs.unread")}</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 font-normal">
                <span>{unreadCount}</span>
              </Badge>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={isPending}
            >
              <CheckCheck className="mr-1.5 h-4 w-4" />
              <span>{t("markAllRead")}</span>
            </Button>
          )}

          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/notifications/settings">
              <Settings className="mr-1.5 h-4 w-4" />
              <span>{t("settings")}</span>
            </Link>
          </Button>
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <Card className="border-dashed border-border/80">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Inbox className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-base font-medium">
              {activeTab === "unread" ? t("emptyUnread") : t("empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => {
            const isUnread = !notif.readAt;
            const formattedDate = new Date(
              notif.createdAt,
            ).toLocaleDateString();

            return (
              <Card
                key={notif.id}
                className={`transition-colors ${
                  isUnread
                    ? "border-primary/40 bg-muted/20"
                    : "border-border/60 bg-card"
                }`}
              >
                <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                        <CardTitle className="text-base font-semibold text-foreground">
                          {notif.title}
                        </CardTitle>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formattedDate}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isUnread && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkRead(notif.id)}
                          disabled={isPending}
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          <span>{t("markAsRead")}</span>
                        </Button>
                      )}

                      {notif.url && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-8"
                        >
                          <Link href={notif.url}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="px-4 pb-4 pt-1 sm:px-5 sm:pb-5 text-sm text-muted-foreground leading-relaxed">
                  {notif.message}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
