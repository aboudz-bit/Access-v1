import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/i18n-context";
import { Languages } from "lucide-react";

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      className={`gap-2 font-medium text-muted-foreground hover:text-primary ${className ?? ""}`}
    >
      <Languages className="w-4 h-4" />
      {lang === "ar" ? "EN" : "العربية"}
    </Button>
  );
}
