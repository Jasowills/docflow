import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Plus, GitBranch, FolderGit2 } from 'lucide-react';
import { useApi } from '../hooks/use-api';
import type { CreateTestPlanRequest, GithubRepositorySummary, TestPlan } from '@docflow/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Spinner } from '../components/ui/spinner';
import { Textarea } from '../components/ui/textarea';

const ENVIRONMENT_OPTIONS = ['Development', 'QA', 'UAT', 'Staging', 'Production'];

export function TestPlansPage() {
  const { listTestPlans, createTestPlan, getGithubStatus, listGithubRepos } = useApi();
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [repos, setRepos] = useState<GithubRepositorySummary[]>([]);
  const [isGithubConnected, setIsGithubConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateTestPlanRequest>({
    name: '',
    description: '',
    repositoryFullName: '',
    branch: '',
    targetEnvironment: '',
    testCaseIds: [],
  });

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextPlans, githubStatus] = await Promise.all([
        listTestPlans(),
        getGithubStatus(),
      ]);
      setPlans(nextPlans);
      setIsGithubConnected(githubStatus.connected);
      if (githubStatus.connected) {
        setRepos(await listGithubRepos());
      } else {
        setRepos([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load test plans.');
    } finally {
      setLoading(false);
    }
  }, [getGithubStatus, listGithubRepos, listTestPlans]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.fullName === form.repositoryFullName),
    [repos, form.repositoryFullName],
  );

  const handleCreate = async () => {
    if (!form.name?.trim()) {
      setError('Test plan name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await createTestPlan({
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        repositoryFullName: form.repositoryFullName || undefined,
        branch: form.branch?.trim() || undefined,
        targetEnvironment: form.targetEnvironment || undefined,
        testCaseIds: form.testCaseIds?.length ? form.testCaseIds : undefined,
      });
      setPlans((previous) => [created, ...previous]);
      setForm({
        name: '',
        description: '',
        repositoryFullName: '',
        branch: '',
        targetEnvironment: '',
        testCaseIds: [],
      });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create test plan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Plans</h1>
          <p className="text-muted-foreground mt-1">
            Organize planned execution by repository, branch, and environment.
          </p>
        </div>
        {loading ? <Spinner className="text-primary mt-1" /> : null}
      </div>

      <div className="context-help-card">
        <p className="text-sm font-medium text-foreground">Bridge generated QA assets into execution.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Test plans tie repositories, environments, and future automated runs together. Connect the GitHub App in Settings, select repos for the workspace, then use plans to organize release validation and regression coverage.
        </p>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create test plan
            </CardTitle>
            <CardDescription>
              Start with a plan shell now. Repo-linked execution and generated run orchestration will build on this.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan-name">Plan name</Label>
              <Input
                id="plan-name"
                placeholder="Smoke plan for account settings"
                value={form.name || ''}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-description">Description</Label>
              <Textarea
                id="plan-description"
                placeholder="What this plan covers, what it validates, and the intended release scope."
                value={form.description || ''}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-repo">Repository</Label>
              <select
                id="plan-repo"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.repositoryFullName || ''}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, repositoryFullName: event.target.value }))
                }
                disabled={!isGithubConnected}
              >
                <option value="">
                  {isGithubConnected ? 'Select a connected repository' : 'Connect GitHub first'}
                </option>
                {repos.map((repo) => (
                  <option key={repo.id} value={repo.fullName}>
                    {repo.fullName}
                  </option>
                ))}
              </select>
              {selectedRepo ? (
                <p className="text-xs text-muted-foreground">
                  Default branch: {selectedRepo.defaultBranch || 'Not reported'}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-branch">Branch</Label>
                <Input
                  id="plan-branch"
                  placeholder="main"
                  value={form.branch || ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, branch: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-environment">Target environment</Label>
                <select
                  id="plan-environment"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.targetEnvironment || ''}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, targetEnvironment: event.target.value }))
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

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button onClick={() => void handleCreate()} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create test plan'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Existing plans
            </CardTitle>
            <CardDescription>
              Plans created in this workspace. Execution runs will attach here later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4 text-primary" />
                Loading plans...
              </div>
            ) : plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No test plans yet. Create the first one to organize work by repo and environment.
              </p>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <div
                    key={plan.planId}
                    className="rounded-md border border-border/80 bg-background/60 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{plan.name}</div>
                        {plan.description ? (
                          <p className="text-sm text-muted-foreground mt-1">
                            {plan.description}
                          </p>
                        ) : null}
                      </div>
                      <Badge variant={plan.status === 'ready' ? 'secondary' : 'outline'}>
                        {plan.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
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
                          {plan.targetEnvironment}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Created {new Date(plan.createdAtUtc).toLocaleString()}
                    </p>

                    <div>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/app/test-plans/${plan.planId}`}>Open plan</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
