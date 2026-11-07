"use client";

import { Bell, CheckCheck, ExternalLink, Inbox } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Notification } from "@/db/schema/notifications";
import {
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from "@/features/notifications/actions";

export interface NotificationBellProps {
  initialUnreadCount: number;
  initialRecentNotifications: Notification[];
}

export function NotificationBell({
  initialUnreadCount,
  initialRecentNotifications,
}: NotificationBellProps) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [recentNotifications, setRecentNotifications] = useState(
    initialRecentNotifications,
  );
  const [isPending, startTransition] = useTransition();

  const handleMarkAllRead = () => {
    startTransition(async () => {
      setUnreadCount(0);
      setRecentNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date() })),
      );
      await markAllNotificationsAsReadAction();
      router.refresh();
    });
  };

  const handleItemClick = (notif: Notification) => {
    if (!notif.readAt) {
      startTransition(async () => {
        setUnreadCount((c) => Math.max(0, c - 1));
        setRecentNotifications((prev) =>
          prev.map((n) =>
            n.id === notif.id ? { ...n, readAt: new Date() } : n,
          ),
        );
        await markNotificationAsReadAction({ id: notif.id });
        router.refresh();
      });
    }
    if (notif.url) {
      router.push(notif.url);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg"
          aria-label={t("title")}
        >
          <Bell className="h-4 w-4 text-foreground" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
            >
              <span>{unreadCount > 9 ? "9+" : unreadCount}</span>
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 shadow-lg">
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm">{t("title")}</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              <span>{t("markAllRead")}</span>
            </Button>
          )}
        </DropdownMenuLabel>

        <DropdownMenuGroup className="max-h-80 overflow-y-auto divide-y divide-border/40">
          {recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <span className="text-xs">{t("empty")}</span>
            </div>
          ) : (
            recentNotifications.slice(0, 5).map((notif) => {
              const isUnread = !notif.readAt;
              const formattedDate = new Date(
                notif.createdAt,
              ).toLocaleDateString();

              return (
                <DropdownMenuItem
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`flex flex-col items-start gap-1 p-3.5 cursor-pointer transition-colors ${
                    isUnread ? "bg-muted/40 font-medium" : "opacity-80"
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="line-clamp-1 text-sm text-foreground font-semibold">
                      {notif.title}
                    </span>
                    {isUnread && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                    {notif.message}
                  </p>
                  <span className="text-[10px] text-muted-foreground/70 pt-1">
                    {formattedDate}
                  </span>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="m-0" />

        <div className="p-2 text-center bg-muted/20">
          <Button variant="ghost" size="sm" asChild className="w-full text-xs">
            <Link href="/dashboard/notifications">
              <span>{t("viewAll")}</span>
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
