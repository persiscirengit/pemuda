"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface ActivityTokenDisplayProps {
  token: string | null;
}

export function ActivityTokenDisplay({ token }: ActivityTokenDisplayProps) {
  const t = useTranslations("activities.events");
  const [copied, setCopied] = React.useState(false);

  if (!token) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success(t("tokenCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2 font-mono text-xs">
      <span className="truncate pr-2">{token}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        <span className="ml-1">{t("copyToken")}</span>
      </Button>
    </div>
  );
}
