import { useGetSession, getGetSessionQueryKey } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PhoneOff } from "lucide-react";

export default function Connecting() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();

  const { data: session } = useGetSession(id, {
    query: {
      queryKey: getGetSessionQueryKey(id),
      enabled: !!id,
      refetchInterval: 2000,
    }
  });

  useEffect(() => {
    if (session?.status === "active") {
      setLocation(`/call/${session.id}`);
    }
  }, [session?.status, session?.id, setLocation]);

  if (!session) {
    return null;
  }

  if (session.status === "declined") {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <PhoneOff className="w-10 h-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">عذراً، لا يوجد مترجم متاح حالياً</h1>
        <p className="text-muted-foreground mb-8 text-center max-w-sm">
          جميع المترجمين منشغلون في الوقت الحالي. يرجى المحاولة مرة أخرى بعد قليل.
        </p>
        <Button size="lg" onClick={() => setLocation("/select-language")} className="rounded-xl px-8 h-12">
          العودة لاختيار اللغة
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Animated background rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-[300px] h-[300px] bg-primary/5 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping" style={{ animationDuration: '3s' }} />
        <div className="w-[450px] h-[450px] bg-primary/5 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }} />
      </div>

      <div className="z-10 flex flex-col items-center">
        <div className="w-24 h-24 bg-card rounded-3xl shadow-lg border border-border flex items-center justify-center mb-8 relative">
          <div className="absolute -right-2 -top-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center animate-bounce">
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
          <span className="text-5xl">{session.language.flagEmoji}</span>
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold mb-3 text-center">جاري الاتصال بمترجم...</h1>
        <p className="text-muted-foreground text-lg text-center">لغة {session.language.nameAr}</p>
        
        {/* We can add a cancel button here later if API supported it, for now just calm waiting */}
      </div>
    </div>
  );
}
