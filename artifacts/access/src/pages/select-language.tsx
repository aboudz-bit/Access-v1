import { useListLanguages, useRequestSession } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";
import { LanguageToggle } from "@/components/language-toggle";
import { Flag } from "@/components/flag";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut } from "lucide-react";

export default function SelectLanguage() {
  const [, setLocation] = useLocation();
  const { logout, user } = useAuth();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  // Only show languages that have at least one interpreter assigned (coverage).
  const { data: languages, isLoading } = useListLanguages({ assigned: true });
  const requestSession = useRequestSession();

  const handleLanguageSelect = (languageId: number) => {
    requestSession.mutate({ data: { languageId } }, {
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
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="flex items-center justify-between p-4 border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <img src="/access-logo.png" alt="Access Logo" className="h-8 object-contain" />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 flex flex-col max-w-4xl mx-auto w-full">
        <div className="mb-8 mt-4 text-center md:text-start">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{t("selectLanguage.welcome")} {user?.name}</h1>
          <p className="text-muted-foreground text-lg">{t("selectLanguage.subtitle")}</p>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {languages?.map((language) => (
              <button
                key={language.id}
                onClick={() => handleLanguageSelect(language.id)}
                disabled={requestSession.isPending}
                className="group flex flex-col items-center justify-center p-6 bg-card border border-border rounded-2xl shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-300 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Flag emoji={language.flagEmoji} className="text-5xl mb-4" />
                <span className="text-xl font-bold text-foreground mb-1">{lang === "ar" ? language.nameAr : language.name}</span>
                <span className="text-sm text-muted-foreground">{lang === "ar" ? language.name : language.nameAr}</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
