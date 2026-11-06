"use client";

import { LogOut, QrCode, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  getVisibleNavSections,
  NAV_SECTIONS,
} from "@/features/shell/nav-config";
import { authClient } from "@/lib/auth-client";
import { PERMISSIONS } from "@/lib/permissions";

export interface AppSidebarProps {
  user: {
    name: string;
    email: string;
    username?: string | null;
    image?: string | null;
  };
  permissions: readonly string[] | string[];
  hasMemberLink?: boolean;
}

export function AppSidebar({
  user,
  permissions,
  hasMemberLink = false,
}: AppSidebarProps) {
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const tShell = useTranslations("shell");
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const visibleSections = getVisibleNavSections(
    NAV_SECTIONS,
    permissions,
    hasMemberLink,
  );

  const canCheckIn =
    hasMemberLink && permissions.includes(PERMISSIONS.ACTIVITIES_CHECKIN_SELF);

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/login";
        },
      },
    });
  };

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 overflow-hidden"
          onClick={handleNavClick}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm">
            <Shield className="size-5" />
          </div>
          <div className="flex flex-col truncate">
            <span className="text-sm font-semibold leading-tight truncate">
              {tCommon("organizationName")}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {tCommon("appName")}
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {canCheckIn && (
          <div className="px-2 py-2">
            <Button
              asChild
              size={isMobile ? "lg" : "default"}
              className="w-full justify-start gap-2 shadow-sm font-medium"
            >
              <Link href="/dashboard/check-in" onClick={handleNavClick}>
                <QrCode className="size-5 shrink-0" />
                <span>{tShell("fieldCheckIn")}</span>
              </Link>
            </Button>
          </div>
        )}

        {visibleSections.map((section) => (
          <SidebarGroup key={section.sectionKey} className="py-1">
            <SidebarGroupLabel className="text-xs font-semibold tracking-wider text-muted-foreground uppercase px-2">
              {tNav(section.sectionKey)}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={tNav(item.titleKey)}
                      >
                        <Link href={item.href} onClick={handleNavClick}>
                          <Icon className="size-4 shrink-0" />
                          <span>{tNav(item.titleKey)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-2">
          <Link
            href="/dashboard/profile"
            onClick={handleNavClick}
            className="flex min-w-0 items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Avatar className="size-8 shrink-0">
              <AvatarImage
                src={user.image ?? undefined}
                alt={tNav("profile")}
              />
              <AvatarFallback className="text-xs">
                {user.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col truncate">
              <span className="text-xs font-semibold leading-tight truncate">
                {user.name}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {user.username ?? user.email}
              </span>
            </div>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            aria-label={tAuth("signOutButton")}
            title={tAuth("signOutButton")}
            className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
