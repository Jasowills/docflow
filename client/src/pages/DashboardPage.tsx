import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  FolderGit2,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import type { DashboardSummary } from "@docflow/shared";
import { useApi } from "../hooks/use-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Spinner } from "../components/ui/spinner";

export function DashboardPage() {
  const { getDashboardSummary } = useApi();
  const headerRef = useRef<HTMLDivElement | null>(null);
  const getDashboardSummaryRef = useRef(getDashboardSummary);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardSummaryRef.current = getDashboardSummary;
  }, [getDashboardSummary]);

  useEffect(() => {
    if (!headerRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-dashboard-hero]",
        {
          opacity: 0,
          y: 18,
          filter: "blur(12px)",
        },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.8,
          ease: "power2.out",
          stagger: 0.12,
        },
      );
    }, headerRef);

    return () => {
      ctx.revert();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    getDashboardSummaryRef.current()
      .then((response) => {
        if (!mounted) return;
        setSummary(response);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(
    () => [
      {
        label: "Recordings",
        value: summary?.metrics.recordings ?? 0,
        copy: "Captured flows in the workspace",
        icon: Upload,
      },
      {
        label: "Documents",
        value: summary?.metrics.documents ?? 0,
        copy: "Generated operational assets",
        icon: FileText,
      },
      {
        label: "Test Plans",
        value: summary?.metrics.activeTestPlans ?? 0,
        copy: "Active execution plans",
        icon: ClipboardCheck,
      },
      {
        label: "Connected Repos",
        value: summary?.metrics.connectedRepos ?? 0,
        copy: "Workspace-selected repositories",
        icon: FolderGit2,
      },
      {
        label: "Members",
        value: summary?.metrics.teamMembers ?? 0,
        copy: "Workspace collaborators",
        icon: Users,
      },
    ],
    [summary],
  );

  return (
    <div className="space-y-6">
      <div ref={headerRef} className="app-page-header">
        <div>
          <p data-dashboard-hero className="app-page-eyebrow">Workspace operations</p>
          <h1 data-dashboard-hero className="app-page-title">Operations dashboard</h1>
          <p data-dashboard-hero className="app-page-copy">
            Track capture volume, generated assets, team activity, and repository readiness from one place.
          </p>
        </div>
        {loading ? <Spinner className="text-primary" /> : null}
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="app-metric-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="app-metric-card">
              <div className="flex items-center justify-between">
                <span className="app-metric-label">{metric.label}</span>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="app-metric-value">{metric.value}</div>
              <p className="app-metric-copy">{metric.copy}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Activity trend</CardTitle>
                <CardDescription>Recent workspace output across recordings and generated assets.</CardDescription>
              </div>
              <Badge variant="secondary">7 days</Badge>
            </CardHeader>
            <CardContent className="grid gap-8 xl:grid-cols-2">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Recordings</span>
                  <span className="text-xs text-muted-foreground">Capture volume</span>
                </div>
                <div className="app-inline-chart">
                  {(summary?.recordingsTrend || []).map((point) => (
                    <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="app-inline-bar w-full"
                        style={{ height: `${Math.max(12, point.value * 22)}px` }}
                      />
                      <span className="text-[11px] text-muted-foreground">{point.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Documents</span>
                  <span className="text-xs text-muted-foreground">Generation volume</span>
                </div>
                <div className="app-inline-chart">
                  {(summary?.documentsTrend || []).map((point) => (
                    <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="app-inline-bar w-full bg-emerald-400/85"
                        style={{ height: `${Math.max(12, point.value * 22)}px` }}
                      />
                      <span className="text-[11px] text-muted-foreground">{point.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <ActivityCard
              title="Recent recordings"
              description="Latest captured flows in the workspace"
              emptyText="No recordings yet. Install the extension or upload your first session."
              items={(summary?.recentRecordings || []).map((recording) => ({
                key: recording.recordingId,
                title: recording.metadata.name,
                description: `${recording.eventCount} events · ${recording.transcriptCount} transcripts`,
                href: `/app/recordings/${recording.recordingId}`,
                badge: recording.metadata.productArea,
              }))}
            />

            <ActivityCard
              title="Recent documents"
              description="Newly generated workflow assets"
              emptyText="No documents yet. Generate docs or test cases from a recording."
              items={(summary?.recentDocuments || []).map((document) => ({
                key: document.documentId,
                title: document.documentTitle,
                description: `${document.documentType} · ${document.recordingName}`,
                href: `/app/documents/${document.documentId}`,
                badge: document.folder || "Unfiled",
              }))}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent workspace activity</CardTitle>
              <CardDescription>Latest changes across recordings, generated docs, and test plans.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(summary?.recentActivity || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity yet.</p>
              ) : (
                summary?.recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-border/80 bg-background/55 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.type}</Badge>
                      <span className="text-sm font-medium text-foreground">{item.title}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {new Date(item.timestampUtc).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
              <CardDescription>Move the workspace forward from the main bottlenecks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <QuickAction to="/app/recordings/upload" icon={Upload} label="Upload recording" />
              <QuickAction to="/app/generate" icon={Sparkles} label="Generate documents" />
              <QuickAction to="/app/test-plans" icon={ClipboardCheck} label="Create test plan" />
              <QuickAction to="/app/settings?section=github" icon={FolderGit2} label="Connect GitHub App" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Setup status</CardTitle>
              <CardDescription>What still needs attention in this workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={summary?.setup.githubConnected ? "secondary" : "outline"}>
                  {summary?.setup.githubConnected ? "GitHub connected" : "GitHub pending"}
                </Badge>
                <Badge
                  variant={summary?.setup.onboardingCompleted ? "secondary" : "outline"}
                >
                  {summary?.setup.onboardingCompleted ? "Onboarding done" : "Onboarding active"}
                </Badge>
              </div>

              {(summary?.setup.missingSteps || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Workspace setup is in a strong state.</p>
              ) : (
                <div className="space-y-2">
                  {summary?.setup.missingSteps.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-border/80 bg-background/50 px-4 py-3 text-sm text-muted-foreground"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan readiness</CardTitle>
              <CardDescription>Current test plan distribution across the workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(summary?.testPlanStatus || []).map((status) => (
                <div key={status.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize text-foreground">{status.label}</span>
                    <span className="text-muted-foreground">{status.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-background/80">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.min(100, status.value * 28)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof Upload;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-2xl border border-border/80 bg-background/55 px-4 py-3 text-sm font-medium text-foreground transition hover:bg-accent/70"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function ActivityCard({
  title,
  description,
  emptyText,
  items,
}: {
  title: string;
  description: string;
  emptyText: string;
  items: Array<{ key: string; title: string; description: string; href: string; badge?: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          items.map((item) => (
            <Link
              key={item.key}
              to={item.href}
              className="block rounded-2xl border border-border/80 bg-background/55 px-4 py-3 transition hover:bg-accent/70"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{item.title}</span>
                {item.badge ? <Badge variant="outline">{item.badge}</Badge> : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
