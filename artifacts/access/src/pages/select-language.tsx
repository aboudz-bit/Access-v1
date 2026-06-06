import { useMemo } from "react";
import { useListLanguages, useRequestSession } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";
import { LanguageToggle } from "@/components/language-toggle";
import { Flag } from "@/components/flag";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, LogOut, Menu } from "lucide-react";

function initials(name?: string): string {
  if (!name) return "•";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]).join("");
  return (letters || name[0] || "•").toUpperCase();
}

export default function SelectLanguage() {
  const [, setLocation] = useLocation();
  const { logout, user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();

  // Full language list (the visual grid) + the set that currently has interpreter
  // coverage (the only ones that can actually be requested). Both come from the
  // existing endpoint — no backend change. Unavailable languages are shown but
  // disabled so the grid still reads like the full reference layout while
  // honoring real availability.
  const { data: allLanguages, isLoading } = useListLanguages();
  const { data: availableLanguages } = useListLanguages({ assigned: true });
  const availableIds = useMemo(
    () => new Set((availableLanguages ?? []).map((l) => l.id)),
    [availableLanguages],
  );

  const requestSession = useRequestSession();

  const handleLanguageSelect = (languageId: number) => {
    requestSession.mutate(
      { data: { languageId } },
      {
        onSuccess: (session) => {
          // V1 direct-open: the session is created already active, so go straight
          // to the call screen — there is no pending/connecting step anymore.
          setLocation(`/call/${session.id}`);
        },
        onError: () => {
          // Most commonly: no interpreter is available for that language right now.
          toast({
            title: t("connecting.noInterpreter"),
            description: t("connecting.busyDesc"),
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-muted/40">
      {/* Header: hamburger (start/right in RTL), centered logo, profile (end/left) */}
      <header className="relative flex items-center justify-between px-4 sm:px-6 h-16 border-b border-border/40 bg-card/70 backdrop-blur-md sticky top-0 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.menu")}
              className="text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-6 h-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <DropdownMenuLabel className="truncate">{user?.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="gap-2 cursor-pointer">
              <LogOut className="w-4 h-4" />
              {t("common.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <img
          src="/access-logo.png"
          alt="Access Logo"
          className="absolute left-1/2 -translate-x-1/2 h-8 object-contain pointer-events-none"
        />

        <div className="flex items-center gap-2">
          <span
            className="grid place-items-center w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-bold select-none"
            aria-hidden="true"
          >
            {initials(user?.name)}
          </span>
          <LanguageToggle />
        </div>
      </header>

      {/* Main: large white card holding the title, subtitle and language grid */}
      <main className="flex-1 flex justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-5xl bg-card border border-border/60 rounded-3xl shadow-sm p-6 sm:p-10 lg:p-14">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-primary tracking-tight mb-3">
              {t("selectLanguage.title")}
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg">
              {t("selectLanguage.subtitle")}
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-6 sm:gap-y-8">
              {allLanguages?.map((language) => {
                const available = availableIds.has(language.id);
                return (
                  <button
                    key={language.id}
                    type="button"
                    onClick={() => available && handleLanguageSelect(language.id)}
                    disabled={!available || requestSession.isPending}
                    aria-disabled={!available}
                    title={!available ? t("selectLanguage.unavailable") : undefined}
                    className={cn(
                      "group flex items-center justify-center gap-3 sm:gap-4 rounded-2xl p-3 sm:p-4 min-h-[76px] transition-all duration-200",
                      available
                        ? "cursor-pointer hover:bg-primary/5 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        : "opacity-40 cursor-not-allowed",
                    )}
                  >
                    {/* Circular flag (start/right in RTL) */}
                    <span className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-1 ring-border/50 shadow-sm shrink-0 transition-transform duration-200 group-hover:scale-105">
                      <Flag
                        emoji={language.flagEmoji}
                        square
                        className="absolute inset-0 !w-full !h-full !rounded-none"
                      />
                    </span>
                    {/* Arabic name (end/left in RTL) */}
                    <span className="flex flex-col items-start min-w-0">
                      <span className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-full">
                        {language.nameAr}
                      </span>
                      {!available && (
                        <span className="text-[11px] text-muted-foreground">
                          {t("selectLanguage.unavailable")}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Loading overlay while a session/interpreter is being requested */}
      {requestSession.isPending && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-lg font-medium text-foreground">
            {t("selectLanguage.searching")}
          </p>
        </div>
      )}
    </div>
  );
}
