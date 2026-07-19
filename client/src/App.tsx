import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Records from "./pages/Records";
import CashFlow from "./pages/CashFlow";
import BranchComparison from "./pages/BranchComparison";
import GrowthReport from "./pages/GrowthReport";
import { useAuth } from "./_core/hooks/useAuth";
import InstallPrompt from "./components/InstallPrompt";

const OWNER_EMAIL = "taherhhisam7@gmail.com";

/** حماية المسارات الخاصة بالادمن: إذا كان المستخدم عاديًا يعيده إلى /records */
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return null; // DashboardLayout تتولى شاشة تسجيل الدخول
  if (user.email !== OWNER_EMAIL) return <Redirect to="/records" />;
  return <Component />;
}

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={() => <AdminRoute component={Dashboard} />} />
        <Route path="/records" component={Records} />
        <Route path="/cash-flow" component={CashFlow} />
        <Route path="/branch-comparison" component={() => <AdminRoute component={BranchComparison} />} />
        <Route path="/growth-report" component={() => <AdminRoute component={GrowthReport} />} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          <InstallPrompt />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
