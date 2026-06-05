import { useGetInterpreterProfile, useUpdateInterpreterStatus, useListInterpreterSessions, useRespondToSession, getListInterpreterSessionsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, Check, X, Clock, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function InterpreterDashboard() {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();

  const { data: profile } = useGetInterpreterProfile();
  const updateStatus = useUpdateInterpreterStatus();
  const respondSession = useRespondToSession();

  const { data: sessions } = useListInterpreterSessions({
    query: {
      queryKey: getListInterpreterSessionsQueryKey(),
      refetchInterval: 2000,
    }
  });

  const pendingSession = sessions?.find(s => s.status === "pending");
  const pastSessions = sessions?.filter(s => s.status !== "pending") || [];

  const handleStatusToggle = (checked: boolean) => {
    updateStatus.mutate({ data: { status: checked ? "available" : "offline" } });
  };

  const handleRespond = (id: number, action: "accept" | "decline") => {
    respondSession.mutate({ id, data: { action } }, {
      onSuccess: (session) => {
        if (action === "accept") {
          setLocation(`/call/${session.id}`);
        }
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="flex items-center justify-between p-4 border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <img src="/access-logo.png" alt="Access Logo" className="h-8 object-contain" />
          <Badge variant="outline" className="hidden sm:inline-flex">لوحة المترجم</Badge>
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
                {profile.status === "available" ? "متاح" : profile.status === "busy" ? "مشغول" : "غير متاح"}
              </Label>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full flex flex-col gap-6">
        {pendingSession && (
          <div className="bg-primary/10 border-2 border-primary/20 rounded-2xl p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-1 bg-primary animate-pulse" />
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-card rounded-2xl shadow-sm border border-border flex items-center justify-center text-4xl">
                  {pendingSession.language.flagEmoji}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-1">طلب ترجمة جديد</h2>
                  <p className="text-muted-foreground text-lg">من: {pendingSession.userName} • لغة {pendingSession.language.nameAr}</p>
                </div>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <Button 
                  variant="destructive" 
                  size="lg" 
                  className="flex-1 md:w-32 h-14 rounded-xl"
                  onClick={() => handleRespond(pendingSession.id, "decline")}
                  disabled={respondSession.isPending}
                >
                  <X className="w-5 h-5 ml-2" />
                  رفض
                </Button>
                <Button 
                  size="lg" 
                  className="flex-1 md:w-32 h-14 rounded-xl bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleRespond(pendingSession.id, "accept")}
                  disabled={respondSession.isPending}
                >
                  <Check className="w-5 h-5 ml-2" />
                  قبول
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Sidebar */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-4">لغاتي</h3>
              <div className="flex flex-wrap gap-2">
                {profile?.languages.map(lang => (
                  <Badge key={lang.id} variant="secondary" className="px-3 py-1.5 text-sm">
                    {lang.flagEmoji} {lang.nameAr}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* History */}
          <div className="md:col-span-2">
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-bold">الجلسات السابقة</h3>
              </div>
              <div className="p-0">
                {pastSessions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                    <Clock className="w-12 h-12 mb-3 opacity-20" />
                    <p>لا يوجد جلسات سابقة بعد</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {pastSessions.map(session => (
                      <div key={session.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-lg">
                            {session.language.flagEmoji}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{session.userName}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(session.createdAt).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <Badge variant={session.status === 'ended' ? 'outline' : 'secondary'} className={session.status === 'ended' ? 'text-green-600 border-green-600/30' : ''}>
                          {session.status === 'ended' ? 'مكتمل' : session.status === 'active' ? 'نشط' : 'مرفوض'}
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
