import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Lang = "ar" | "en";

type TranslationDict = Record<string, string>;

const translations: Record<Lang, TranslationDict> = {
  ar: {
    "common.email": "البريد الإلكتروني",
    "common.password": "كلمة المرور",
    "common.name": "الاسم",
    "common.accept": "قبول",
    "common.decline": "رفض",
    "common.cancel": "إلغاء",
    "common.save": "حفظ",
    "common.create": "إنشاء",
    "common.edit": "تعديل",
    "common.delete": "حذف",
    "common.add": "إضافة",
    "common.status": "الحالة",
    "common.languages": "اللغات",
    "common.actions": "الإجراءات",
    "common.all": "الكل",
    "common.loading": "جاري التحميل...",

    "login.tagline": "أكسس - للترجمة الفورية بلغة الإشارة",
    "login.errorTitle": "خطأ في تسجيل الدخول",
    "login.errorDesc": "تأكد من البريد الإلكتروني وكلمة المرور",
    "login.submit": "تسجيل الدخول",
    "login.invalidEmail": "البريد الإلكتروني غير صالح",
    "login.passwordRequired": "كلمة المرور مطلوبة",
    "login.rememberMe": "تذكرني",
    "login.showPassword": "إظهار كلمة المرور",
    "login.hidePassword": "إخفاء كلمة المرور",
    "login.loading": "جاري تسجيل الدخول...",

    "selectLanguage.welcome": "مرحباً",
    "selectLanguage.subtitle": "اختر لغة الترجمة للبدء",

    "connecting.noInterpreter": "عذراً، لا يوجد مترجم متاح حالياً",
    "connecting.busyDesc": "جميع المترجمين منشغلون في الوقت الحالي. يرجى المحاولة مرة أخرى بعد قليل.",
    "connecting.backToSelect": "العودة لاختيار اللغة",
    "connecting.connecting": "جاري الاتصال بمترجم...",
    "connecting.languagePrefix": "لغة",

    "call.connecting": "متصل بالمترجم...",

    "interpreter.badge": "لوحة المترجم",
    "interpreter.newRequest": "طلب ترجمة جديد",
    "interpreter.fromPrefix": "من:",
    "interpreter.myLanguages": "لغاتي",
    "interpreter.pastSessions": "الجلسات السابقة",
    "interpreter.noPastSessions": "لا يوجد جلسات سابقة بعد",

    "status.available": "متاح",
    "status.busy": "مشغول",
    "status.offline": "غير متاح",

    "sessionStatus.pending": "قيد الانتظار",
    "sessionStatus.active": "نشط",
    "sessionStatus.ended": "مكتمل",
    "sessionStatus.declined": "مرفوض",

    "admin.badge": "الإدارة",
    "admin.stats.users": "المستخدمين",
    "admin.stats.interpreters": "المترجمين (متاحين)",
    "admin.stats.activeSessions": "جلسات نشطة",
    "admin.stats.completedSessions": "جلسات مكتملة",

    "admin.tabs.sessions": "الجلسات",
    "admin.tabs.interpreters": "المترجمين",
    "admin.tabs.users": "المستخدمين",
    "admin.tabs.languages": "اللغات",

    "admin.sessions.id": "رقم الجلسة",
    "admin.sessions.user": "المستخدم",
    "admin.sessions.interpreter": "المترجم",
    "admin.sessions.language": "اللغة",
    "admin.sessions.time": "الوقت",
    "admin.sessions.empty": "لا يوجد جلسات",
    "admin.sessions.filter": "تصفية حسب الحالة",

    "admin.interpreters.empty": "لا يوجد مترجمين",
    "admin.interpreters.add": "إضافة مترجم",
    "admin.interpreters.addTitle": "إضافة مترجم جديد",
    "admin.interpreters.editLanguages": "تعديل اللغات",
    "admin.interpreters.editLanguagesTitle": "تعديل لغات المترجم",

    "admin.users.add": "إضافة مستخدم",
    "admin.users.addTitle": "إضافة مستخدم جديد",
    "admin.users.id": "رقم",
    "admin.users.role": "الدور",

    "admin.languages.add": "إضافة لغة",
    "admin.languages.addTitle": "إضافة لغة جديدة",
    "admin.languages.editTitle": "تعديل اللغة",
    "admin.languages.code": "الرمز",
    "admin.languages.name": "الاسم (إنجليزي)",
    "admin.languages.nameAr": "الاسم (عربي)",
    "admin.languages.flagEmoji": "العلم",
    "admin.languages.deleteConfirm": "هل أنت متأكد من حذف هذه اللغة؟",
    "admin.languages.empty": "لا يوجد لغات",
    "admin.languages.selectAtLeastOne": "اختر لغة واحدة على الأقل",

    "toast.success": "تم بنجاح",
    "toast.error": "حدث خطأ",
    "toast.userCreated": "تم إنشاء المستخدم",
    "toast.interpreterCreated": "تم إنشاء المترجم",
    "toast.statusUpdated": "تم تحديث الحالة",
    "toast.languagesUpdated": "تم تحديث اللغات",
    "toast.languageCreated": "تم إنشاء اللغة",
    "toast.languageUpdated": "تم تحديث اللغة",
    "toast.languageDeleted": "تم حذف اللغة",
  },
  en: {
    "common.email": "Email",
    "common.password": "Password",
    "common.name": "Name",
    "common.accept": "Accept",
    "common.decline": "Decline",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.create": "Create",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.add": "Add",
    "common.status": "Status",
    "common.languages": "Languages",
    "common.actions": "Actions",
    "common.all": "All",
    "common.loading": "Loading...",

    "login.tagline": "Access - Live Sign Language Interpretation",
    "login.errorTitle": "Login Error",
    "login.errorDesc": "Check your email and password",
    "login.submit": "Log In",
    "login.invalidEmail": "Invalid email address",
    "login.passwordRequired": "Password is required",
    "login.rememberMe": "Remember Me",
    "login.showPassword": "Show password",
    "login.hidePassword": "Hide password",
    "login.loading": "Logging in...",

    "selectLanguage.welcome": "Welcome",
    "selectLanguage.subtitle": "Choose an interpretation language to start",

    "connecting.noInterpreter": "Sorry, no interpreter is available right now",
    "connecting.busyDesc": "All interpreters are currently busy. Please try again shortly.",
    "connecting.backToSelect": "Back to language selection",
    "connecting.connecting": "Connecting to an interpreter...",
    "connecting.languagePrefix": "Language",

    "call.connecting": "Connecting to interpreter...",

    "interpreter.badge": "Interpreter Dashboard",
    "interpreter.newRequest": "New Interpretation Request",
    "interpreter.fromPrefix": "From:",
    "interpreter.myLanguages": "My Languages",
    "interpreter.pastSessions": "Past Sessions",
    "interpreter.noPastSessions": "No past sessions yet",

    "status.available": "Available",
    "status.busy": "Busy",
    "status.offline": "Offline",

    "sessionStatus.pending": "Pending",
    "sessionStatus.active": "Active",
    "sessionStatus.ended": "Ended",
    "sessionStatus.declined": "Declined",

    "admin.badge": "Admin",
    "admin.stats.users": "Users",
    "admin.stats.interpreters": "Interpreters (available)",
    "admin.stats.activeSessions": "Active sessions",
    "admin.stats.completedSessions": "Completed sessions",

    "admin.tabs.sessions": "Sessions",
    "admin.tabs.interpreters": "Interpreters",
    "admin.tabs.users": "Users",
    "admin.tabs.languages": "Languages",

    "admin.sessions.id": "Session #",
    "admin.sessions.user": "User",
    "admin.sessions.interpreter": "Interpreter",
    "admin.sessions.language": "Language",
    "admin.sessions.time": "Time",
    "admin.sessions.empty": "No sessions",
    "admin.sessions.filter": "Filter by status",

    "admin.interpreters.empty": "No interpreters",
    "admin.interpreters.add": "Add interpreter",
    "admin.interpreters.addTitle": "Add new interpreter",
    "admin.interpreters.editLanguages": "Edit languages",
    "admin.interpreters.editLanguagesTitle": "Edit interpreter languages",

    "admin.users.add": "Add user",
    "admin.users.addTitle": "Add new user",
    "admin.users.id": "#",
    "admin.users.role": "Role",

    "admin.languages.add": "Add language",
    "admin.languages.addTitle": "Add new language",
    "admin.languages.editTitle": "Edit language",
    "admin.languages.code": "Code",
    "admin.languages.name": "Name (English)",
    "admin.languages.nameAr": "Name (Arabic)",
    "admin.languages.flagEmoji": "Flag",
    "admin.languages.deleteConfirm": "Are you sure you want to delete this language?",
    "admin.languages.empty": "No languages",
    "admin.languages.selectAtLeastOne": "Select at least one language",

    "toast.success": "Success",
    "toast.error": "An error occurred",
    "toast.userCreated": "User created",
    "toast.interpreterCreated": "Interpreter created",
    "toast.statusUpdated": "Status updated",
    "toast.languagesUpdated": "Languages updated",
    "toast.languageCreated": "Language created",
    "toast.languageUpdated": "Language updated",
    "toast.languageDeleted": "Language deleted",
  },
};

type I18nContextType = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
};

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = "access_lang";

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "ar";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "ar" ? stored : "ar";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
  }, []);

  const t = useCallback(
    (key: string) => {
      return translations[lang][key] ?? key;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}
