import { useGetAdminStats, useListUsers, useListInterpreters, useListAdminSessions, useListLanguages } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut, Users, Video, Clock, CheckCircle2, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const { logout } = useAuth();
  
  const { data: stats } = useGetAdminStats();
  const { data: users } = useListUsers();
  const { data: interpreters } = useListInterpreters();
  const { data: sessions } = useListAdminSessions();
  const { data: languages } = useListLanguages();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="flex items-center justify-between p-4 border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <img src="/access-logo.png" alt="Access Logo" className="h-8 object-contain" />
          <Badge className="hidden sm:inline-flex bg-primary/20 text-primary hover:bg-primary/30 border-none">الإدارة</Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-foreground">
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-8">
        
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">المستخدمين</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">المترجمين (متاحين)</CardTitle>
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.availableInterpreters || 0} <span className="text-muted-foreground text-sm font-normal">/ {stats?.totalInterpreters || 0}</span></div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">جلسات نشطة</CardTitle>
              <Video className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.activeSessions || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">جلسات مكتملة</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.completedSessions || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sessions" className="w-full" dir="rtl">
          <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
            <TabsTrigger value="sessions">الجلسات</TabsTrigger>
            <TabsTrigger value="interpreters">المترجمين</TabsTrigger>
            <TabsTrigger value="users">المستخدمين</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sessions" className="mt-6">
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4">رقم الجلسة</th>
                      <th className="px-6 py-4">المستخدم</th>
                      <th className="px-6 py-4">المترجم</th>
                      <th className="px-6 py-4">اللغة</th>
                      <th className="px-6 py-4">الحالة</th>
                      <th className="px-6 py-4">الوقت</th>
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
                            <span>{session.language.flagEmoji}</span>
                            <span>{session.language.nameAr}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={
                            session.status === 'active' ? 'default' : 
                            session.status === 'ended' ? 'outline' : 
                            session.status === 'pending' ? 'secondary' : 'destructive'
                          }>
                            {session.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground" dir="ltr">
                          {new Date(session.createdAt).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                    {sessions?.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">لا يوجد جلسات</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="interpreters" className="mt-6">
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4">الاسم</th>
                      <th className="px-6 py-4">البريد الإلكتروني</th>
                      <th className="px-6 py-4">اللغات</th>
                      <th className="px-6 py-4">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {interpreters?.map((inter) => (
                      <tr key={inter.id} className="hover:bg-muted/30">
                        <td className="px-6 py-4 font-medium">{inter.name}</td>
                        <td className="px-6 py-4 text-muted-foreground">{inter.email}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {inter.languages.map(l => (
                              <Badge key={l.id} variant="secondary" className="text-xs">{l.flagEmoji}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${inter.status === 'available' ? 'bg-green-500' : inter.status === 'busy' ? 'bg-amber-500' : 'bg-gray-300'}`} />
                            <span className="capitalize">{inter.status}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
             <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4">رقم</th>
                      <th className="px-6 py-4">الاسم</th>
                      <th className="px-6 py-4">البريد الإلكتروني</th>
                      <th className="px-6 py-4">الدور</th>
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
        </Tabs>
      </main>
    </div>
  );
}
