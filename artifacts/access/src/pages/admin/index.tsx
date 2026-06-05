import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAdminStats,
  useListUsers,
  useListInterpreters,
  useListAdminSessions,
  useListLanguages,
  useCreateUser,
  useCreateInterpreter,
  useSetInterpreterStatus,
  useSetInterpreterLanguages,
  useCreateLanguage,
  useUpdateLanguage,
  useDeleteLanguage,
  getListUsersQueryKey,
  getListInterpretersQueryKey,
  getListAdminSessionsQueryKey,
  getListLanguagesQueryKey,
  getGetAdminStatsQueryKey,
} from "@workspace/api-client-react";
import type { Interpreter, Language, SessionStatus, InterpreterStatus } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";
import { LanguageToggle } from "@/components/language-toggle";
import { Flag } from "@/components/flag";
import { Button } from "@/components/ui/button";
import { LogOut, Users, Video, CheckCircle2, ShieldCheck, Plus, Pencil, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const { logout } = useAuth();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [sessionStatusFilter, setSessionStatusFilter] = useState<SessionStatus | "all">("all");

  const sessionsParams = sessionStatusFilter === "all" ? undefined : { status: sessionStatusFilter };

  const { data: stats } = useGetAdminStats();
  const { data: users } = useListUsers();
  const { data: interpreters } = useListInterpreters();
  const { data: sessions } = useListAdminSessions(sessionsParams, {
    query: { queryKey: getListAdminSessionsQueryKey(sessionsParams) },
  });
  const { data: languages } = useListLanguages();

  const langName = (l: Language) => (lang === "ar" ? l.nameAr : l.name);

  const invalidate = (keys: readonly (readonly unknown[])[]) => {
    keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  };

  const onMutationError = () => {
    toast({ title: t("toast.error"), variant: "destructive" });
  };

  // ---- Create user ----
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "" });
  const createUser = useCreateUser();

  const submitUser = () => {
    createUser.mutate(
      { data: userForm },
      {
        onSuccess: () => {
          toast({ title: t("toast.userCreated") });
          setUserDialogOpen(false);
          setUserForm({ name: "", email: "", password: "" });
          invalidate([getListUsersQueryKey(), getGetAdminStatsQueryKey()]);
        },
        onError: onMutationError,
      }
    );
  };

  // ---- Create interpreter ----
  const [interpreterDialogOpen, setInterpreterDialogOpen] = useState(false);
  const [interpreterForm, setInterpreterForm] = useState<{
    name: string;
    email: string;
    password: string;
    languageIds: number[];
  }>({ name: "", email: "", password: "", languageIds: [] });
  const createInterpreter = useCreateInterpreter();

  const toggleInterpreterFormLanguage = (id: number) => {
    setInterpreterForm((prev) => ({
      ...prev,
      languageIds: prev.languageIds.includes(id)
        ? prev.languageIds.filter((x) => x !== id)
        : [...prev.languageIds, id],
    }));
  };

  const submitInterpreter = () => {
    if (interpreterForm.languageIds.length === 0) {
      toast({ title: t("admin.languages.selectAtLeastOne"), variant: "destructive" });
      return;
    }
    createInterpreter.mutate(
      { data: interpreterForm },
      {
        onSuccess: () => {
          toast({ title: t("toast.interpreterCreated") });
          setInterpreterDialogOpen(false);
          setInterpreterForm({ name: "", email: "", password: "", languageIds: [] });
          invalidate([getListInterpretersQueryKey(), getGetAdminStatsQueryKey()]);
        },
        onError: onMutationError,
      }
    );
  };

  // ---- Interpreter status ----
  const setInterpreterStatus = useSetInterpreterStatus();

  const changeInterpreterStatus = (id: number, status: InterpreterStatus) => {
    setInterpreterStatus.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          toast({ title: t("toast.statusUpdated") });
          invalidate([getListInterpretersQueryKey(), getGetAdminStatsQueryKey()]);
        },
        onError: onMutationError,
      }
    );
  };

  // ---- Interpreter languages ----
  const [langsDialogInterpreter, setLangsDialogInterpreter] = useState<Interpreter | null>(null);
  const [langsForm, setLangsForm] = useState<number[]>([]);
  const setInterpreterLanguages = useSetInterpreterLanguages();

  const openLangsDialog = (inter: Interpreter) => {
    setLangsDialogInterpreter(inter);
    setLangsForm(inter.languages.map((l) => l.id));
  };

  const toggleLangsFormLanguage = (id: number) => {
    setLangsForm((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const submitLangs = () => {
    if (!langsDialogInterpreter) return;
    if (langsForm.length === 0) {
      toast({ title: t("admin.languages.selectAtLeastOne"), variant: "destructive" });
      return;
    }
    setInterpreterLanguages.mutate(
      { id: langsDialogInterpreter.id, data: { languageIds: langsForm } },
      {
        onSuccess: () => {
          toast({ title: t("toast.languagesUpdated") });
          setLangsDialogInterpreter(null);
          invalidate([getListInterpretersQueryKey()]);
        },
        onError: onMutationError,
      }
    );
  };

  // ---- Languages CRUD ----
  const emptyLanguage = { code: "", name: "", nameAr: "", flagEmoji: "" };
  const [languageDialogOpen, setLanguageDialogOpen] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<Language | null>(null);
  const [languageForm, setLanguageForm] = useState(emptyLanguage);
  const createLanguage = useCreateLanguage();
  const updateLanguage = useUpdateLanguage();
  const deleteLanguage = useDeleteLanguage();

  const openCreateLanguage = () => {
    setEditingLanguage(null);
    setLanguageForm(emptyLanguage);
    setLanguageDialogOpen(true);
  };

  const openEditLanguage = (l: Language) => {
    setEditingLanguage(l);
    setLanguageForm({ code: l.code, name: l.name, nameAr: l.nameAr, flagEmoji: l.flagEmoji });
    setLanguageDialogOpen(true);
  };

  const submitLanguage = () => {
    if (editingLanguage) {
      updateLanguage.mutate(
        { id: editingLanguage.id, data: languageForm },
        {
          onSuccess: () => {
            toast({ title: t("toast.languageUpdated") });
            setLanguageDialogOpen(false);
            invalidate([getListLanguagesQueryKey()]);
          },
          onError: onMutationError,
        }
      );
    } else {
      createLanguage.mutate(
        { data: languageForm },
        {
          onSuccess: () => {
            toast({ title: t("toast.languageCreated") });
            setLanguageDialogOpen(false);
            invalidate([getListLanguagesQueryKey()]);
          },
          onError: onMutationError,
        }
      );
    }
  };

  const removeLanguage = (l: Language) => {
    if (!window.confirm(t("admin.languages.deleteConfirm"))) return;
    deleteLanguage.mutate(
      { id: l.id },
      {
        onSuccess: () => {
          toast({ title: t("toast.languageDeleted") });
          invalidate([getListLanguagesQueryKey()]);
        },
        onError: onMutationError,
      }
    );
  };

  const sessionStatusLabel = (status: SessionStatus) => t(`sessionStatus.${status}`);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="flex items-center justify-between p-4 border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <img src="/access-logo.png" alt="Access Logo" className="h-8 object-contain" />
          <Badge className="hidden sm:inline-flex bg-primary/20 text-primary hover:bg-primary/30 border-none">{t("admin.badge")}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-8">

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.stats.users")}</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.stats.interpreters")}</CardTitle>
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.availableInterpreters || 0} <span className="text-muted-foreground text-sm font-normal">/ {stats?.totalInterpreters || 0}</span></div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.stats.activeSessions")}</CardTitle>
              <Video className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.activeSessions || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.stats.completedSessions")}</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.completedSessions || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sessions" className="w-full" dir={lang === "ar" ? "rtl" : "ltr"}>
          <TabsList className="grid w-full grid-cols-4 max-w-[520px]">
            <TabsTrigger value="sessions">{t("admin.tabs.sessions")}</TabsTrigger>
            <TabsTrigger value="interpreters">{t("admin.tabs.interpreters")}</TabsTrigger>
            <TabsTrigger value="users">{t("admin.tabs.users")}</TabsTrigger>
            <TabsTrigger value="languages">{t("admin.tabs.languages")}</TabsTrigger>
          </TabsList>

          {/* ---- Sessions ---- */}
          <TabsContent value="sessions" className="mt-6">
            <div className="flex items-center justify-end mb-4">
              <div className="w-full sm:w-[220px]">
                <Select
                  value={sessionStatusFilter}
                  onValueChange={(v) => setSessionStatusFilter(v as SessionStatus | "all")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.sessions.filter")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    <SelectItem value="pending">{t("sessionStatus.pending")}</SelectItem>
                    <SelectItem value="active">{t("sessionStatus.active")}</SelectItem>
                    <SelectItem value="ended">{t("sessionStatus.ended")}</SelectItem>
                    <SelectItem value="declined">{t("sessionStatus.declined")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 text-start">{t("admin.sessions.id")}</th>
                      <th className="px-6 py-4 text-start">{t("admin.sessions.user")}</th>
                      <th className="px-6 py-4 text-start">{t("admin.sessions.interpreter")}</th>
                      <th className="px-6 py-4 text-start">{t("admin.sessions.language")}</th>
                      <th className="px-6 py-4 text-start">{t("common.status")}</th>
                      <th className="px-6 py-4 text-start">{t("admin.sessions.time")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sessions?.map((session) => (
                      <tr key={session.id} className="hover:bg-muted/30">
                        <td className="px-6 py-4 font-mono text-muted-foreground">#{session.id}</td>
                        <td className="px-6 py-4">{session.userName}</td>
                        <td className="px-6 py-4">{session.interpreterName || '-'}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Flag emoji={session.language.flagEmoji} className="text-base" />
                            <span>{langName(session.language)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={
                            session.status === 'active' ? 'default' :
                            session.status === 'ended' ? 'outline' :
                            session.status === 'pending' ? 'secondary' : 'destructive'
                          }>
                            {sessionStatusLabel(session.status)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground" dir="ltr">
                          {new Date(session.createdAt).toLocaleString(lang === "ar" ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                    {sessions?.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">{t("admin.sessions.empty")}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ---- Interpreters ---- */}
          <TabsContent value="interpreters" className="mt-6">
            <div className="flex items-center justify-end mb-4">
              <Button onClick={() => setInterpreterDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                {t("admin.interpreters.add")}
              </Button>
            </div>
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 text-start">{t("common.name")}</th>
                      <th className="px-6 py-4 text-start">{t("common.email")}</th>
                      <th className="px-6 py-4 text-start">{t("common.languages")}</th>
                      <th className="px-6 py-4 text-start">{t("common.status")}</th>
                      <th className="px-6 py-4 text-start">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {interpreters?.map((inter) => (
                      <tr key={inter.id} className="hover:bg-muted/30">
                        <td className="px-6 py-4 font-medium">{inter.name}</td>
                        <td className="px-6 py-4 text-muted-foreground">{inter.email}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {inter.languages.map((l) => (
                              <Badge key={l.id} variant="secondary" className="text-xs"><Flag emoji={l.flagEmoji} className="mr-1" /> {langName(l)}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Select
                            value={inter.status}
                            onValueChange={(v) => changeInterpreterStatus(inter.id, v as InterpreterStatus)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="available">{t("status.available")}</SelectItem>
                              <SelectItem value="busy">{t("status.busy")}</SelectItem>
                              <SelectItem value="offline">{t("status.offline")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4">
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => openLangsDialog(inter)}>
                            <Pencil className="w-3.5 h-3.5" />
                            {t("admin.interpreters.editLanguages")}
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {interpreters?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">{t("admin.interpreters.empty")}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ---- Users ---- */}
          <TabsContent value="users" className="mt-6">
            <div className="flex items-center justify-end mb-4">
              <Button onClick={() => setUserDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                {t("admin.users.add")}
              </Button>
            </div>
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 text-start">{t("admin.users.id")}</th>
                      <th className="px-6 py-4 text-start">{t("common.name")}</th>
                      <th className="px-6 py-4 text-start">{t("common.email")}</th>
                      <th className="px-6 py-4 text-start">{t("admin.users.role")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users?.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/30">
                        <td className="px-6 py-4 text-muted-foreground">#{u.id}</td>
                        <td className="px-6 py-4 font-medium">{u.name}</td>
                        <td className="px-6 py-4 text-muted-foreground">{u.email}</td>
                        <td className="px-6 py-4">
                          <Badge variant={u.role === 'admin' ? 'default' : 'outline'}>{u.role}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ---- Languages ---- */}
          <TabsContent value="languages" className="mt-6">
            <div className="flex items-center justify-end mb-4">
              <Button onClick={openCreateLanguage} className="gap-2">
                <Plus className="w-4 h-4" />
                {t("admin.languages.add")}
              </Button>
            </div>
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 text-start">{t("admin.languages.flagEmoji")}</th>
                      <th className="px-6 py-4 text-start">{t("admin.languages.code")}</th>
                      <th className="px-6 py-4 text-start">{t("admin.languages.name")}</th>
                      <th className="px-6 py-4 text-start">{t("admin.languages.nameAr")}</th>
                      <th className="px-6 py-4 text-start">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {languages?.map((l) => (
                      <tr key={l.id} className="hover:bg-muted/30">
                        <td className="px-6 py-4"><Flag emoji={l.flagEmoji} className="text-2xl" /></td>
                        <td className="px-6 py-4 font-mono text-muted-foreground">{l.code}</td>
                        <td className="px-6 py-4">{l.name}</td>
                        <td className="px-6 py-4">{l.nameAr}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => openEditLanguage(l)}>
                              <Pencil className="w-3.5 h-3.5" />
                              {t("common.edit")}
                            </Button>
                            <Button variant="destructive" size="sm" className="gap-2" onClick={() => removeLanguage(l)}>
                              <Trash2 className="w-3.5 h-3.5" />
                              {t("common.delete")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {languages?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">{t("admin.languages.empty")}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* ---- Add User Dialog ---- */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("admin.users.addTitle")}</DialogTitle>
            <DialogDescription className="sr-only">{t("admin.users.addTitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.name")}</Label>
              <Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.email")}</Label>
              <Input type="email" dir="ltr" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.password")}</Label>
              <Input type="password" dir="ltr" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUserDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={submitUser} disabled={createUser.isPending}>{t("common.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Add Interpreter Dialog ---- */}
      <Dialog open={interpreterDialogOpen} onOpenChange={setInterpreterDialogOpen}>
        <DialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("admin.interpreters.addTitle")}</DialogTitle>
            <DialogDescription className="sr-only">{t("admin.interpreters.addTitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.name")}</Label>
              <Input value={interpreterForm.name} onChange={(e) => setInterpreterForm({ ...interpreterForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.email")}</Label>
              <Input type="email" dir="ltr" value={interpreterForm.email} onChange={(e) => setInterpreterForm({ ...interpreterForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.password")}</Label>
              <Input type="password" dir="ltr" value={interpreterForm.password} onChange={(e) => setInterpreterForm({ ...interpreterForm, password: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.languages")}</Label>
              <div className="flex flex-wrap gap-2">
                {languages?.map((l) => {
                  const selected = interpreterForm.languageIds.includes(l.id);
                  return (
                    <button
                      type="button"
                      key={l.id}
                      onClick={() => toggleInterpreterFormLanguage(l.id)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50"}`}
                    >
                      <Flag emoji={l.flagEmoji} className="mr-1" /> {langName(l)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInterpreterDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={submitInterpreter} disabled={createInterpreter.isPending}>{t("common.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Edit Interpreter Languages Dialog ---- */}
      <Dialog open={!!langsDialogInterpreter} onOpenChange={(open) => { if (!open) setLangsDialogInterpreter(null); }}>
        <DialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("admin.interpreters.editLanguagesTitle")}</DialogTitle>
            <DialogDescription className="sr-only">{t("admin.interpreters.editLanguagesTitle")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {languages?.map((l) => {
              const selected = langsForm.includes(l.id);
              return (
                <button
                  type="button"
                  key={l.id}
                  onClick={() => toggleLangsFormLanguage(l.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50"}`}
                >
                  <Flag emoji={l.flagEmoji} className="mr-1" /> {langName(l)}
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLangsDialogInterpreter(null)}>{t("common.cancel")}</Button>
            <Button onClick={submitLangs} disabled={setInterpreterLanguages.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Language Create/Edit Dialog ---- */}
      <Dialog open={languageDialogOpen} onOpenChange={setLanguageDialogOpen}>
        <DialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{editingLanguage ? t("admin.languages.editTitle") : t("admin.languages.addTitle")}</DialogTitle>
            <DialogDescription className="sr-only">{editingLanguage ? t("admin.languages.editTitle") : t("admin.languages.addTitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("admin.languages.code")}</Label>
              <Input dir="ltr" value={languageForm.code} onChange={(e) => setLanguageForm({ ...languageForm, code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.languages.name")}</Label>
              <Input dir="ltr" value={languageForm.name} onChange={(e) => setLanguageForm({ ...languageForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.languages.nameAr")}</Label>
              <Input dir="rtl" value={languageForm.nameAr} onChange={(e) => setLanguageForm({ ...languageForm, nameAr: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.languages.flagEmoji")}</Label>
              <Input value={languageForm.flagEmoji} onChange={(e) => setLanguageForm({ ...languageForm, flagEmoji: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLanguageDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={submitLanguage} disabled={createLanguage.isPending || updateLanguage.isPending}>
              {editingLanguage ? t("common.save") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
