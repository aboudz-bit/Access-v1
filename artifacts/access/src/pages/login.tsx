import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";
import { LanguageToggle } from "@/components/language-toggle";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";

// Local-only preference keys. These do NOT change the authentication strategy:
// the server still controls the session cookie/TTL. "Remember me" persists the
// user's preference and (when enabled) pre-fills their email on the next visit.
const REMEMBER_KEY = "access_remember_me";
const REMEMBER_EMAIL_KEY = "access_remember_email";

function readRemember(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(REMEMBER_KEY) === "true";
  } catch {
    return false;
  }
}

function readRememberedEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return readRemember() ? (window.localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "") : "";
  } catch {
    return "";
  }
}

export default function Login() {
  const { toast } = useToast();
  const { refetchUser } = useAuth();
  const { t } = useI18n();
  const loginMutation = useLogin();

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(readRemember);

  const loginSchema = z.object({
    email: z.string().email(t("login.invalidEmail")),
    password: z.string().min(1, t("login.passwordRequired")),
  });

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: readRememberedEmail(),
      password: "",
    },
  });

  const persistRemember = (checked: boolean, email?: string) => {
    setRememberMe(checked);
    try {
      window.localStorage.setItem(REMEMBER_KEY, String(checked));
      if (checked) {
        if (email !== undefined) window.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      } else {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  };

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    // Prevent duplicate submissions (double click / repeated Enter).
    if (loginMutation.isPending) return;

    // Persist the "remember me" preference (and email when enabled) before the
    // request. Auth itself is unchanged — the server still issues the cookie.
    persistRemember(rememberMe, values.email);

    loginMutation.mutate({ data: values }, {
      onSuccess: () => {
        refetchUser();
      },
      onError: (error: any) => {
        toast({
          title: t("login.errorTitle"),
          description: error.message || t("login.errorDesc"),
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="absolute top-4 right-4 z-20">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-sm space-y-8 z-10">
        <div className="flex flex-col items-center space-y-4">
          <img src="/access-logo.png" alt="Access Logo" className="h-16 object-contain" />
          <p className="text-muted-foreground text-center">{t("login.tagline")}</p>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl shadow-xl p-6 sm:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.email")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="name@example.com"
                        type="email"
                        autoComplete="email"
                        {...field}
                        dir="ltr"
                        className="text-left"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.password")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="••••••••"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          {...field}
                          dir="ltr"
                          className="text-left pr-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                          aria-pressed={showPassword}
                          tabIndex={-1}
                          className="absolute inset-y-0 right-0 flex items-center justify-center w-11 text-muted-foreground hover:text-foreground transition-colors rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) =>
                    persistRemember(checked === true, form.getValues("email"))
                  }
                />
                <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer select-none">
                  {t("login.rememberMe")}
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base rounded-xl font-medium shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
                disabled={loginMutation.isPending}
                aria-busy={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t("login.loading")}
                  </span>
                ) : (
                  t("login.submit")
                )}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
