"use client";

import { BellRing, Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  getVapidPublicKeyAction,
  revokePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushNotificationAction,
} from "@/features/notifications/actions";
import {
  arrayBufferToBase64,
  urlBase64ToUint8Array,
} from "@/features/notifications/push/utils";

export function WebPushToggle() {
  const t = useTranslations("notifications");
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();
  const [isTesting, startTestTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setIsSupported(false);
      return;
    }

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setIsSubscribed(!!subscription);
      })
      .catch(() => {
        setIsSubscribed(false);
      });
  }, []);

  const handleToggle = (checked: boolean) => {
    startTransition(async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          toast.error(t("webPushNotSupported"));
          return;
        }

        if (checked) {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            toast.error(t("webPushPermissionDenied"));
            return;
          }

          const registration = await navigator.serviceWorker.register("/sw.js");
          await navigator.serviceWorker.ready;

          const keyRes = await getVapidPublicKeyAction();
          const vapidKey = keyRes?.data?.publicKey;

          if (!vapidKey) {
            toast.error(t("webPushNotSupported"));
            return;
          }

          const convertedKey = urlBase64ToUint8Array(vapidKey);
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey as unknown as BufferSource,
          });

          const p256dh = arrayBufferToBase64(subscription.getKey("p256dh"));
          const auth = arrayBufferToBase64(subscription.getKey("auth"));

          await savePushSubscriptionAction({
            endpoint: subscription.endpoint,
            publicKey: p256dh,
            authToken: auth,
            userAgent: navigator.userAgent,
            deviceName: navigator.userAgent.slice(0, 90),
          });

          setIsSubscribed(true);
          toast.success(t("webPushSubscribed"));
        } else {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();

          if (subscription) {
            await revokePushSubscriptionAction({
              endpoint: subscription.endpoint,
            });
            await subscription.unsubscribe();
          }

          setIsSubscribed(false);
          toast.success(t("webPushUnsubscribed"));
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message);
      }
    });
  };

  const handleSendTest = () => {
    startTestTransition(async () => {
      try {
        const res = await sendTestPushNotificationAction();
        if (res?.data?.success) {
          toast.success(t("testPushSent"));
        } else {
          toast.error(t("testPushError"));
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message);
      }
    });
  };

  if (!isSupported) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        {t("webPushNotSupported")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BellRing className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("webPushTitle")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("webPushDescription")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isPending && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          <Switch
            checked={isSubscribed}
            onCheckedChange={handleToggle}
            disabled={isPending}
            aria-label={t("enableWebPush")}
          />
        </div>
      </div>

      {isSubscribed && (
        <div className="mt-4 flex justify-end border-t border-border pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendTest}
            disabled={isTesting || isPending}
          >
            {isTesting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            {t("sendTestPush")}
          </Button>
        </div>
      )}
    </div>
  );
}
