import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { FileText, LayoutDashboard, List, Settings, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useParams } from "react-router-dom";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, activeFor: "dashboard" },
  { label: "Recordings", icon: List, activeFor: "dashboard" },
  { label: "Generate", icon: Sparkles, activeFor: "documents" },
  { label: "Documents", icon: FileText, activeFor: "documents" },
  { label: "Settings", icon: Settings, activeFor: "dashboard" },
];

export function ShowcaseScreenPage() {
  const params = useParams<{ shot?: string }>();
  const shot = params.shot === "documents" ? params.shot : "dashboard";

  const content = useMemo(() => {
    if (shot === "documents") return <DocumentsShot />;
    return <DashboardShot />;
  }, [shot]);

  return (
    <div className="min-h-screen bg-[#020503] p-8 text-white">
      <div className="mx-auto flex h-[860px] w-[1440px] overflow-hidden rounded-[32px] border border-white/10 bg-[#030706] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
        <aside className="flex w-[310px] shrink-0 flex-col border-r border-white/8 bg-[#05110c]">
          <div className="border-b border-white/8 p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-300/70">
              Workspace
            </p>
            <h1 className="mt-3 text-[30px] font-semibold tracking-tight">Jason's Workspace</h1>
            <p className="mt-3 max-w-[22rem] text-sm leading-6 text-zinc-400">
              Personal operations for workflow capture, generation, and documentation.
            </p>
          </div>
          <nav className="grid gap-1 px-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.activeFor === shot;
              return (
                <div
                  key={`${shot}-${item.label}`}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium ${
                    isActive
                      ? "bg-emerald-500 text-black shadow-[0_14px_40px_rgba(34,197,94,0.18)]"
                      : "text-zinc-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                </div>
              );
            })}
          </nav>
          <div className="mt-auto p-4">
            <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
              <div className="text-sm font-medium">Jason Amadi</div>
              <div className="mt-1 text-xs text-zinc-500">jason@example.com</div>
            </div>
          </div>
        </aside>

        <main className="flex-1 bg-[#040706]">
          <header className="border-b border-white/8 bg-black/10 px-8 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/70">DocFlow Ops</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {shot === "dashboard" ? "Operations dashboard" : "Generated documents"}
            </h2>
          </header>
          <div className="p-8">{content}</div>
        </main>
      </div>
    </div>
  );
}

function DashboardShot() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-5">
        {[
          ["Recordings", "42"],
          ["Documents", "18"],
          ["Members", "4"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[28px] border border-white/8 bg-[#0a100d] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
            <div className="mt-4 text-4xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1.2fr_0.8fr] gap-6">
        <Card className="border-white/8 bg-[#09100d] text-white">
          <CardHeader>
            <CardTitle>Activity trend</CardTitle>
            <CardDescription className="text-zinc-400">Recent workspace output across recordings and documents.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-60 items-end gap-3">
              {[4, 5, 7, 3, 6, 8, 5].map((value, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-3">
                  <div className="w-full rounded-t-xl bg-emerald-400/85" style={{ height: `${value * 18}px` }} />
                  <span className="text-xs text-zinc-500">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][index]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/8 bg-[#09100d] text-white">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription className="text-zinc-400">Move the workspace forward from the main bottlenecks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {["Upload recording", "Generate documents", "Review documents"].map((label) => (
              <div key={label} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm">
                {label}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DocumentsShot() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">Review-ready output from captured sessions.</p>
        </div>
        <Button className="rounded-2xl bg-emerald-500 text-black hover:bg-emerald-400">Generate asset</Button>
      </div>
      <div className="grid gap-4">
        {[
          ["Checkout flow release notes", "release_notes", "Checkout settings review"],
          ["Account setup test suite", "test_suite", "Onboarding capture"],
          ["Workspace permissions guide", "user_guide", "Admin settings walkthrough"],
        ].map(([title, type, source]) => (
          <div key={title} className="rounded-[26px] border border-white/8 bg-[#09100d] p-5">
            <div className="flex items-center gap-3">
              <span className="text-base font-medium">{title}</span>
              <Badge variant="outline" className="border-white/10 text-zinc-300">{type}</Badge>
            </div>
            <p className="mt-3 text-sm text-zinc-400">Generated from {source}. Ready for review and folder assignment.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
