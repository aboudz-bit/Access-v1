import { useEffect } from "react";
import { useGetInterpreterProfile, useUpdateInterpreterStatus, useListInterpreterSessions, getListInterpreterSessionsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";
import { LanguageToggle } from "@/components/language-toggle";
import { Flag } from "@/components/flag";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function InterpreterDashboard() {
  const { logout } = useAuth();
  const { t, lang } = useI18n();
  const [, setLocation] = useLocation();

  const { data: profile } = useGetInterpreterProfile();
  const updateStatus = useUpdateInterpreterStatus();

  const { data: sessions, isFetching } = useListInterpreterSessions({
    query: {
      queryKey: getListInterpreterSessionsQueryKey(),
      refetchInterval: 2000,
      // Keep polling even when the interpreter's tab is in the background so a
      // newly assigned session still auto-routes them into the call.
      refetchIntervalInBackground: true,
    }
  });

  // V1: no manual accept/decline. When the system assigns the interpreter to a
  // session it is created already active, so route straight into the call.
  const activeSession = sessions?.find(s => s.status === "active");
  const pastSessions = sessions?.filter(s => s.status === "ended" || s.status === "declined") || [];

  // Gate on `!isFetching` so a just-ended session served from a stale cache
  // (right after returning from a call) does not bounce us back into the call.
  useEffect(() => {
    if (activeSession && !isFetching) {
      setLocation(`/call/${activeSession.id}`);
    }
  }, [activeSession?.id, isFetching, setLocation]);

  const handleStatusToggle = (checked: boolean) => {
    updateStatus.mutate({ data: { status: checked ? "available" : "offline" } });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="flex items-center justify-between p-4 border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <img src="/access-logo.png" alt="Access Logo" className="h-8 object-contain" />
          <Badge variant="outline" className="hidden sm:inline-flex">{t("interpreter.badge")}</Badge>
        </div>
        <div className="flex items-center gap-4">
          {profile && (
            <div className="flex items-center gap-2" dir="ltr">
              <Switch 
                id="status" 
                checked={profile.status === "available"} 
                onCheckedChange={handleStatusToggle}
                disabled={updateStatus.isPending || profile.status === "busy"}
              />
              <Label htmlFor="status" className="font-medium">
                {profile.status === "available" ? t("status.available") : profile.status === "busy" ? t("status.busy") : t("status.offline")}
              </Label>
            </div>
          )}
          <LanguageToggle />
          <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Sidebar */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-4">{t("interpreter.myLanguages")}</h3>
              <div className="flex flex-wrap gap-2">
                {profile?.languages.map(language => (
                  <Badge key={language.id} variant="secondary" className="px-3 py-1.5 text-sm">
                    <Flag emoji={language.flagEmoji} className="mr-1.5" /> {lang === "ar" ? language.nameAr : language.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* History */}
          <div className="md:col-span-2">
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-bold">{t("interpreter.pastSessions")}</h3>
              </div>
              <div className="p-0">
                {pastSessions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                    <Clock className="w-12 h-12 mb-3 opacity-20" />
                    <p>{t("interpreter.noPastSessions")}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {pastSessions.map(session => (
                      <div key={session.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-lg overflow-hidden">
                            <Flag emoji={session.language.flagEmoji} className="text-lg" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{session.userName}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(session.createdAt).toLocaleDateString(lang === "ar" ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <Badge variant={session.status === 'ended' ? 'outline' : 'secondary'} className={session.status === 'ended' ? 'text-green-600 border-green-600/30' : ''}>
                          {session.status === 'ended' ? t("sessionStatus.ended") : session.status === 'active' ? t("sessionStatus.active") : t("sessionStatus.declined")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
