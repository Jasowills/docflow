import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderGit2,
  GitBranch,
  Play,
  Rocket,
} from 'lucide-react';
import type {
  CreateTestPlanRunRequest,
  DocumentSummary,
  TestPlanDetail,
  TestPlanExecutionRun,
} from '@docflow/shared';
import { useApi } from '../hooks/use-api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Spinner } from '../components/ui/spinner';
import { Textarea } from '../components/ui/textarea';

const ENVIRONMENT_OPTIONS = ['Development', 'QA', 'UAT', 'Staging', 'Production'];

export function TestPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getTestPlanDetail,
    attachTestPlanSuites,
    createTestPlanRun,
    listDocuments,
  } = useApi();
  const [detail, setDetail] = useState<TestPlanDetail | null>(null);
  const [availableSuites, setAvailableSuites] = useState<DocumentSummary[]>([]);
  const [selectedSuiteIds, setSelectedSuiteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSuites, setSavingSuites] = useState(false);
  const [creatingRun, setCreatingRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runForm, setRunForm] = useState<CreateTestPlanRunRequest>({
    branch: '',
    targetEnvironment: '',
    notes: '',
  });

  useEffect(() => {
    if (!id) {
      navigate('/app/test-plans', { replace: true });
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      getTestPlanDetail(id),
      listDocuments({ page: 1, pageSize: 100, documentType: 'test_case_suite' }),
    ])
      .then(([planDetail, suitesResponse]) => {
        setDetail(planDetail);
        setSelectedSuiteIds(planDetail.plan.testCaseIds);
        setAvailableSuites(suitesResponse.items);
        setRunForm({
          branch: planDetail.plan.branch || '',
          targetEnvironment: planDetail.plan.targetEnvironment || '',
          notes: '',
        });
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load test plan.');
      })
      .finally(() => setLoading(false));
  }, [getTestPlanDetail, id, listDocuments, navigate]);

  const attachedSuiteIds = useMemo(
    () => new Set(detail?.attachedSuites.map((suite) => suite.documentId) || []),
    [detail],
  );

  const runCounts = useMemo(() => {
    const runs = detail?.runs || [];
    return {
      total: runs.length,
      queued: runs.filter((run) => run.status === 'queued').length,
      completed: runs.filter((run) => ['passed', 'failed', 'cancelled'].includes(run.status)).length,
    };
  }, [detail]);

  const handleToggleSuite = (documentId: string) => {
    setSelectedSuiteIds((current) =>
      current.includes(documentId)
        ? current.filter((value) => value !== documentId)
        : [...current, documentId],
    );
  };

  const handleSaveSuites = async () => {
    if (!id) return;
    setSavingSuites(true);
    setError(null);
    try {
      const updated = await attachTestPlanSuites(id, { documentIds: selectedSuiteIds });
      setDetail(updated);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update test suites.');
    } finally {
      setSavingSuites(false);
    }
  };

  const handleCreateRun = async () => {
    if (!id || !detail) return;
    setCreatingRun(true);
    setError(null);
    try {
      const run = (await createTestPlanRun(id, {
        branch: runForm.branch?.trim() || undefined,
        targetEnvironment: runForm.targetEnvironment || undefined,
        notes: runForm.notes?.trim() || undefined,
      })) as TestPlanExecutionRun;
      setDetail((current) =>
        current
          ? {
              ...current,
              runs: [run, ...current.runs],
            }
          : current,
      );
      setRunForm((current) => ({ ...current, notes: '' }));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Unable to create execution run.');
    } finally {
      setCreatingRun(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-muted-foreground">
        <Spinner className="h-4 w-4 text-primary" />
        Loading test plan...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/test-plans">
            <ArrowLeft className="h-4 w-4" />
            Back to test plans
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              {error || 'The requested test plan could not be loaded.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { plan, attachedSuites, runs } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
            <Link to="/app/test-plans">
              <ArrowLeft className="h-4 w-4" />
              Back to test plans
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{plan.name}</h1>
            <Badge variant={plan.status === 'ready' ? 'secondary' : 'outline'}>{plan.status}</Badge>
          </div>
          {plan.description ? (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{plan.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {plan.repositoryFullName ? (
              <span className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1">
                <FolderGit2 className="h-3.5 w-3.5" />
                {plan.repositoryFullName}
              </span>
            ) : null}
            {plan.branch ? (
              <span className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1">
                <GitBranch className="h-3.5 w-3.5" />
                {plan.branch}
              </span>
            ) : null}
            {plan.targetEnvironment ? (
              <span className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1">
                <Rocket className="h-3.5 w-3.5" />
                {plan.targetEnvironment}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Attached suites" value={String(attachedSuites.length)} />
          <MetricCard label="Execution runs" value={String(runCounts.total)} />
          <MetricCard label="Queued runs" value={String(runCounts.queued)} />
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Attached test suites
            </CardTitle>
            <CardDescription>
              Generated `test_case_suite` documents attached to this plan. Save the selection to update the plan detail view.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableSuites.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No generated test case suites exist yet. Generate one from a recording, then attach it here.
              </p>
            ) : (
              <div className="space-y-3">
                {availableSuites.map((suite) => {
                  const checked = selectedSuiteIds.includes(suite.documentId);
                  const attached = attachedSuiteIds.has(suite.documentId);
                  return (
                    <label
                      key={suite.documentId}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/80 bg-background/50 p-3"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border"
                        checked={checked}
                        onChange={() => handleToggleSuite(suite.documentId)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{suite.documentTitle}</span>
                          {attached ? <Badge variant="secondary">Attached</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {suite.recordingName} • {suite.productArea}
                        </p>
                        <div className="mt-2">
                          <Button variant="link" size="sm" asChild className="h-auto px-0">
                            <Link to={`/app/documents/${suite.documentId}`}>Open document</Link>
                          </Button>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <Button onClick={() => void handleSaveSuites()} disabled={savingSuites}>
              {savingSuites ? 'Saving...' : 'Save attached suites'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Play className="h-5 w-5" />
              Create execution run
            </CardTitle>
            <CardDescription>
              Seed manual run history now. Playwright-backed execution can build on the same run model later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="run-branch">Branch</Label>
                <Input
                  id="run-branch"
                  value={runForm.branch || ''}
                  placeholder="main"
                  onChange={(event) =>
                    setRunForm((current) => ({ ...current, branch: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-environment">Target environment</Label>
                <select
                  id="run-environment"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={runForm.targetEnvironment || ''}
                  onChange={(event) =>
                    setRunForm((current) => ({
                      ...current,
                      targetEnvironment: event.target.value,
                    }))
                  }
                >
                  <option value="">Select environment</option>
                  {ENVIRONMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="run-notes">Run notes</Label>
              <Textarea
                id="run-notes"
                placeholder="Scope, release candidate, or validation notes for this run."
                value={runForm.notes || ''}
                onChange={(event) =>
                  setRunForm((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </div>

            <Button onClick={() => void handleCreateRun()} disabled={creatingRun}>
              {creatingRun ? 'Creating...' : 'Create execution run'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock3 className="h-5 w-5" />
            Run history
          </CardTitle>
          <CardDescription>
            Execution runs created for this plan. Current runs are placeholders for future orchestration, status updates, and artifacts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No runs have been created yet. Start the first execution run from this page.
            </p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <div
                  key={run.runId}
                  className="rounded-xl border border-border/80 bg-background/50 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{run.runId.slice(0, 8)}</span>
                        <RunStatusBadge status={run.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Created {new Date(run.createdAtUtc).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {run.branch ? (
                        <span className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1">
                          <GitBranch className="h-3.5 w-3.5" />
                          {run.branch}
                        </span>
                      ) : null}
                      {run.targetEnvironment ? (
                        <span className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1">
                          <Rocket className="h-3.5 w-3.5" />
                          {run.targetEnvironment}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {run.notes ? (
                    <p className="mt-3 text-sm text-muted-foreground">{run.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Current attachments
          </CardTitle>
          <CardDescription>
            This reflects the saved plan state. The attachment selector above can be staged before saving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attachedSuites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suites are attached to this plan yet.</p>
          ) : (
            <div className="space-y-3">
              {attachedSuites.map((suite) => (
                <div
                  key={suite.documentId}
                  className="flex flex-col gap-3 rounded-xl border border-border/80 bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{suite.documentTitle}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {suite.recordingName} • {suite.productArea} •{' '}
                      {new Date(suite.createdAtUtc).toLocaleString()}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/app/documents/${suite.documentId}`}>Open suite</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-semibold">{value}</div>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function RunStatusBadge({ status }: { status: TestPlanExecutionRun['status'] }) {
  if (status === 'passed') {
    return <Badge variant="secondary">passed</Badge>;
  }
  if (status === 'failed' || status === 'cancelled') {
    return <Badge variant="outline">{status}</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}
