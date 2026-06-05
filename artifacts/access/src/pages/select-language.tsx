import { useListLanguages, useRequestSession } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut } from "lucide-react";

export default function SelectLanguage() {
  const [, setLocation] = useLocation();
  const { logout, user } = useAuth();
  const { data: languages, isLoading } = useListLanguages();
  const requestSession = useRequestSession();

  const handleLanguageSelect = (languageId: number) => {
    requestSession.mutate({ data: { languageId } }, {
      onSuccess: (session) => {
        setLocation(`/connecting/${session.id}`);
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="flex items-center justify-between p-4 border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <img src="/access-logo.png" alt="Access Logo" className="h-8 object-contain" />
        <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-foreground">
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 p-4 md:p-8 flex flex-col max-w-4xl mx-auto w-full">
        <div className="mb-8 mt-4 text-center md:text-right">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">مرحباً {user?.name}</h1>
          <p className="text-muted-foreground text-lg">اختر لغة الترجمة للبدء</p>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {languages?.map((lang) => (
              <button
                key={lang.id}
                onClick={() => handleLanguageSelect(lang.id)}
                disabled={requestSession.isPending}
                className="group flex flex-col items-center justify-center p-6 bg-card border border-border rounded-2xl shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-300 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="text-5xl mb-4">{lang.flagEmoji}</span>
                <span className="text-xl font-bold text-foreground mb-1">{lang.nameAr}</span>
                <span className="text-sm text-muted-foreground">{lang.name}</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
