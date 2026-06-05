import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import SelectLanguage from "@/pages/select-language";
import Connecting from "@/pages/connecting";
import Call from "@/pages/call";
import InterpreterDashboard from "@/pages/interpreter";
import AdminDashboard from "@/pages/admin";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, allowedRoles }: { component: any, allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-[100dvh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return null; // AuthProvider redirects to /login
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <NotFound />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/select-language">
        {() => <ProtectedRoute component={SelectLanguage} allowedRoles={["user"]} />}
      </Route>
      <Route path="/connecting/:id">
        {() => <ProtectedRoute component={Connecting} allowedRoles={["user"]} />}
      </Route>
      <Route path="/call/:id">
        {() => <ProtectedRoute component={Call} />}
      </Route>
      <Route path="/interpreter">
        {() => <ProtectedRoute component={InterpreterDashboard} allowedRoles={["interpreter"]} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminDashboard} allowedRoles={["admin"]} />}
      </Route>
      <Route path="/">
        {() => <ProtectedRoute component={() => null} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
