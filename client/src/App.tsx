import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Upload from "./pages/Upload";
import Analysis from "./pages/Analysis";
import Dashboard from "./pages/Dashboard";
import SharedAnalysis from "./pages/SharedAnalysis";
import WeeklyOverview from "./pages/WeeklyOverview";
import MatchTypeAnalysis from "./pages/MatchTypeAnalysis";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/upload" component={Upload} />
      <Route path="/analysis/:taskId/match-types" component={MatchTypeAnalysis} />
      <Route path="/analysis/:taskId" component={Analysis} />
      <Route path="/share/:shareToken" component={SharedAnalysis} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/weekly-overview" component={WeeklyOverview} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
