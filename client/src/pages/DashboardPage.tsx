import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import {
  ArrowRight,
  Download,
  FileText,
  Plus,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import type { DashboardSummary } from "@docflow/shared";
import { useApi } from "../hooks/use-api";
import { useAuth } from "../auth/auth-context";
import { useClientDataStore } from "../state/client-data-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";

export function DashboardPage() {
  const { getDashboardSummary, getLatestExtensionRelease } = useApi();
  const { extensionRelease, ensureExtensionRelease } = useClientDataStore();
  const { user } = useAuth();
  const { inviteWorkspaceMember } = useApi();
  const headerRef = useRef<HTMLDivElement | null>(null);
  const getDashboardSummaryRef = useRef(getDashboardSummary);
  const getLatestExtensionReleaseRef = useRef(getLatestExtensionRelease);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingRelease, setLoadingRelease] = useState(!extensionRelease);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [downloadingExtension, setDownloadingExtension] = useState(false);

  useEffect(() => {
    getDashboardSummaryRef.current = getDashboardSummary;
  }, [getDashboardSummary]);

  useEffect(() => {
    getLatestExtensionReleaseRef.current = getLatestExtensionRelease;
  }, [getLatestExtensionRelease]);

  useEffect(() => {
    if (
      !headerRef.current ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
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

    getDashboardSummaryRef
      .current()
      .then((response) => {
        if (!mounted) return;
        setSummary(response);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load dashboard.",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (extensionRelease) {
      setLoadingRelease(false);
      return;
    }

    ensureExtensionRelease(() => getLatestExtensionReleaseRef.current())
      .then(() => {
        if (!mounted) return;
        setReleaseError(null);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setReleaseError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load extension release.",
        );
      })
      .finally(() => {
        if (mounted) setLoadingRelease(false);
      });

    return () => {
      mounted = false;
    };
  }, [ensureExtensionRelease, extensionRelease]);

  const downloadUrl =
    extensionRelease?.downloadUrl ||
    import.meta.env.VITE_EXTENSION_DOWNLOAD_URL;

  const handleDownloadExtension = () => {
    if (!downloadUrl) return;
    setDownloadingExtension(true);
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => setDownloadingExtension(false), 900);
  };

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
        label: "Members",
        value: summary?.metrics.teamMembers ?? 0,
        copy: "Workspace collaborators",
        icon: Users,
      },
    ],
    [summary],
  );
  const hasRecordingTrendData = useMemo(
    () => (summary?.recordingsTrend || []).some((point) => point.value > 0),
    [summary?.recordingsTrend],
  );
  const hasDocumentTrendData = useMemo(
    () => (summary?.documentsTrend || []).some((point) => point.value > 0),
    [summary?.documentsTrend],
  );
  const hasTrendData = hasRecordingTrendData || hasDocumentTrendData;

  return (
    <div className="space-y-6">
      <div ref={headerRef} className="app-page-header">
        <div>
          <p data-dashboard-hero className="app-page-eyebrow">
            Workspace operations
          </p>
          <h1 data-dashboard-hero className="app-page-title">
            Operations dashboard
          </h1>
          <p data-dashboard-hero className="app-page-copy">
            Track capture volume, generated assets, and workspace activity from
            one place.
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
                <CardDescription>
                  Recent workspace output across recordings and generated
                  assets.
                </CardDescription>
              </div>
              <Badge variant="secondary">7 days</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  Recordings
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                  Documents
                </span>
              </div>
              {!loading && !hasTrendData ? (
                <p className="text-xs text-muted-foreground">
                  No recording or document activity in the last 7 days.
                </p>
              ) : null}
              <CombinedTrendChart
                labels={
                  summary?.recordingsTrend?.map((point) => point.label) || []
                }
                recordings={summary?.recordingsTrend || []}
                documents={summary?.documentsTrend || []}
              />
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
                description: `${recording.eventCount} events | ${recording.transcriptCount} transcripts`,
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
                description: `${document.documentType} | ${document.recordingName}`,
                href: `/app/documents/${document.documentId}`,
                badge: document.folder || "Unfiled",
              }))}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent workspace activity</CardTitle>
              <CardDescription>
                Latest changes across recordings and generated documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(summary?.recentActivity || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent activity yet.
                </p>
              ) : (
                summary?.recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="rounded border border-border/80 bg-background/55 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.type}</Badge>
                      <span className="text-sm font-medium text-foreground">
                        {item.title}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.description}
                    </p>
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
              <CardTitle>DocFlow Recorder</CardTitle>
              <CardDescription>
                Download the latest extension package any time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {extensionRelease ? (
                <div className="rounded border border-border/80 bg-background/55 px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">
                    Latest published release: v{extensionRelease.version}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Published{" "}
                    {new Date(extensionRelease.publishedAtUtc).toLocaleString()}
                  </p>
                  {extensionRelease.notes ? (
                    <p className="mt-2 text-muted-foreground">
                      {extensionRelease.notes}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {downloadUrl ? (
                <Button
                  className="w-full"
                  onClick={handleDownloadExtension}
                  loading={downloadingExtension}
                >
                  <Download className="h-4 w-4" />
                  {downloadingExtension
                    ? "Starting download..."
                    : "Download extension"}
                </Button>
              ) : (
                <div className="rounded border border-border/80 bg-background/55 px-4 py-3 text-sm text-muted-foreground">
                  {loadingRelease
                    ? "Loading latest extension release..."
                    : releaseError || "Download URL is not configured yet."}
                </div>
              )}

              <Link
                to="/app/getting-started"
                state={{ fromGuide: true }}
                className="flex items-center justify-between rounded border border-border/80 bg-background/55 px-4 py-3 text-sm font-medium text-foreground transition hover:bg-accent/70"
              >
                <span>Open install guide</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
              <CardDescription>
                Move the workspace forward from the main bottlenecks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <InlineLoadingState message="Loading quick actions..." />
              ) : (
                <>
                  <QuickAction
                    to="/app/recordings/upload"
                    icon={Upload}
                    label="Upload recording"
                  />
                  <QuickAction
                    to="/app/generate"
                    icon={Sparkles}
                    label="Generate documents"
                  />
                  <QuickAction
                    to="/app/documents"
                    icon={FileText}
                    label="Review documents"
                  />
                </>
              )}
            </CardContent>
          </Card>

          <InviteMembersCard
            canInvite={!!user?.roles?.some((r) => r === "owner" || r === "admin")}
            onInvite={inviteWorkspaceMember}
          />

          <Card>
            <CardHeader>
              <CardTitle>Setup status</CardTitle>
              <CardDescription>
                What still needs attention in this workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <InlineLoadingState message="Loading setup status..." />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        summary?.setup.onboardingCompleted
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {summary?.setup.onboardingCompleted
                        ? "Onboarding done"
                        : "Onboarding active"}
                    </Badge>
                  </div>

                  {(summary?.setup.missingSteps || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Workspace setup is in a strong state.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {summary?.setup.missingSteps.map((item) => (
                        <div
                          key={item}
                          className="rounded border border-border/80 bg-background/50 px-4 py-3 text-sm text-muted-foreground"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InlineLoadingState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-border/80 bg-background/55 px-4 py-3 text-sm text-muted-foreground">
      <Spinner className="h-4 w-4 text-primary" />
      <span>{message}</span>
    </div>
  );
}

function CombinedTrendChart({
  labels,
  recordings,
  documents,
}: {
  labels: string[];
  recordings: DashboardSummary["recordingsTrend"];
  documents: DashboardSummary["documentsTrend"];
}) {
  const width = 720;
  const height = 220;
  const paddingX = 22;
  const paddingTop = 18;
  const paddingBottom = 28;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(
    1,
    ...recordings.map((point) => point.value),
    ...documents.map((point) => point.value),
  );
  const stepX =
    labels.length > 1 ? (width - paddingX * 2) / (labels.length - 1) : 0;

  const toCoordinates = (points: DashboardSummary["recordingsTrend"]) =>
    points.map((point, index) => {
      const x = paddingX + stepX * index;
      const y =
        paddingTop + chartHeight - (point.value / maxValue) * chartHeight;
      return { x, y, value: point.value, label: point.label };
    });

  const recordingsCoordinates = toCoordinates(recordings);
  const documentsCoordinates = toCoordinates(documents);

  const buildLinePath = (coordinates: Array<{ x: number; y: number }>) =>
    coordinates
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

  const buildAreaPath = (coordinates: Array<{ x: number; y: number }>) =>
    coordinates.length > 0
      ? [
          `M ${coordinates[0].x} ${height - paddingBottom}`,
          ...coordinates.map((point) => `L ${point.x} ${point.y}`),
          `L ${coordinates[coordinates.length - 1].x} ${height - paddingBottom}`,
          "Z",
        ].join(" ")
      : "";

  const recordingsLinePath = buildLinePath(recordingsCoordinates);
  const documentsLinePath = buildLinePath(documentsCoordinates);
  const recordingsAreaPath = buildAreaPath(recordingsCoordinates);
  const documentsAreaPath = buildAreaPath(documentsCoordinates);

  return (
    <div className="rounded border border-border/60 bg-background/35 p-4">
      <div className="rounded bg-white/[0.03] px-2 py-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-56 w-full overflow-visible"
        >
          <path
            d={`M ${paddingX} ${height - paddingBottom} H ${width - paddingX}`}
            className="stroke-border/70"
            strokeWidth="1"
            fill="none"
          />
          {Array.from({ length: 4 }).map((_, index) => {
            const y = paddingTop + (chartHeight / 3) * index;
            return (
              <path
                key={index}
                d={`M ${paddingX} ${y} H ${width - paddingX}`}
                className="stroke-white/6"
                strokeWidth="1"
                fill="none"
                strokeDasharray="3 6"
              />
            );
          })}
          {recordingsAreaPath ? (
            <path d={recordingsAreaPath} className="fill-primary/10" />
          ) : null}
          {documentsAreaPath ? (
            <path d={documentsAreaPath} className="fill-emerald-300/10" />
          ) : null}
          {recordingsLinePath ? (
            <path
              d={recordingsLinePath}
              className="stroke-primary"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {documentsLinePath ? (
            <path
              d={documentsLinePath}
              className="stroke-emerald-300"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {recordingsCoordinates.map((point) => (
            <g key={point.label}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5.5"
                className="fill-background"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="3.5"
                className="fill-primary"
              />
            </g>
          ))}
          {documentsCoordinates.map((point) => (
            <g key={`document-${point.label}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5.5"
                className="fill-background"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="3.5"
                className="fill-emerald-300"
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2">
        {labels.map((label, index) => (
          <div key={`${label}-${index}`} className="space-y-1 text-center">
            <div className="text-[11px] font-medium text-foreground/80">
              {recordings[index]?.value ?? 0} / {documents[index]?.value ?? 0}
            </div>
            <div className="text-[11px] text-muted-foreground">{label}</div>
          </div>
        ))}
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
      className="flex items-center justify-between rounded border border-border/80 bg-background/55 px-4 py-3 text-sm font-medium text-foreground transition hover:bg-accent/70"
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
  items: Array<{
    key: string;
    title: string;
    description: string;
    href: string;
    badge?: string;
  }>;
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
              className="block rounded border border-border/80 bg-background/55 px-4 py-3 transition hover:bg-accent/70"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {item.title}
                </span>
                {item.badge ? (
                  <Badge variant="outline">{item.badge}</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.description}
              </p>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function InviteMembersCard({
  canInvite,
  onInvite,
}: {
  canInvite: boolean;
  onInvite: (request: { email: string; role: "admin" | "editor" }) => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor">("editor");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canInvite) return null;

  const handleSubmit = async () => {
    setError(null);
    setResult(null);
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onInvite({ email: email.trim(), role });
      setResult(`${email} invited as ${role}.`);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Invite members
        </CardTitle>
        <CardDescription>
          Add someone to the workspace by email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            className="h-9 w-full rounded-md border border-border/80 bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "editor")}
            className="h-9 w-full rounded-md border border-border/80 bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button
          className="w-full"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
        >
          <Plus className="h-4 w-4" />
          {isSubmitting ? "Sending..." : "Send invitation"}
        </Button>
        {result ? (
          <p className="text-xs text-emerald-400">{result}</p>
        ) : null}
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}