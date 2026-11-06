import { ArrowRight, BookOpen, Calendar, Shield, Sparkles } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { ActivityCard } from "@/features/public/components/activity-card";
import { ArticleCard } from "@/features/public/components/article-card";
import { PublicFooter } from "@/features/public/components/public-footer";
import { PublicHeader } from "@/features/public/components/public-header";
import {
  getFeaturedArticles,
  getUpcomingPublicActivities,
} from "@/server/dal/content/public-articles";

export default async function HomePage() {
  const tLanding = await getTranslations("landing");

  const [featuredArticles, upcomingActivities] = await Promise.all([
    getFeaturedArticles(3),
    getUpcomingPublicActivities(4),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-muted/50 to-background py-16 sm:py-24">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-xs">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>{tLanding("heroTitle")}</span>
              </div>

              <h1 className="font-extrabold tracking-tight text-3xl sm:text-5xl lg:text-6xl text-foreground">
                {tLanding("heroTitle")}
              </h1>

              <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                {tLanding("heroSubtitle")}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button size="lg" asChild className="w-full sm:w-auto">
                  <Link href="/articles">
                    <span>{tLanding("exploreArticles")}</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="w-full sm:w-auto"
                >
                  <Link href="/dashboard">
                    <span>{tLanding("memberPortal")}</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Articles Section */}
        <section className="py-16 sm:py-20 border-b border-border/40">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6 space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
                  {tLanding("featuredSectionTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {tLanding("featuredSectionSubtitle")}
                </p>
              </div>
              <Button
                variant="ghost"
                asChild
                className="self-start sm:self-auto"
              >
                <Link href="/articles">
                  <span>{tLanding("allArticles")}</span>
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {featuredArticles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-12 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {tLanding("noArticles")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Upcoming Activities Section */}
        <section className="py-16 sm:py-20 border-b border-border/40 bg-muted/20">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6 space-y-10">
            <div className="space-y-1">
              <h2 className="font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
                {tLanding("activitiesSectionTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {tLanding("activitiesSectionSubtitle")}
              </p>
            </div>

            {upcomingActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-12 text-center bg-background">
                <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {tLanding("noActivities")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {upcomingActivities.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-16 sm:py-20">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield className="h-6 w-6" />
            </div>
            <h2 className="font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
              {tLanding("missionTitle")}
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              {tLanding("missionText")}
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
