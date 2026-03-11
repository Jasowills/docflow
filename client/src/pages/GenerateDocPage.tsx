import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/use-api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Spinner } from '../components/ui/spinner';
import { Sparkles, Loader2, Wand2 } from 'lucide-react';
import type {
  RecordingDocument,
  RecordingSummary,
  PaginatedResponse,
  DocumentTypeConfig,
  SystemConfig,
  TestCaseGenerationContext,
} from '@docflow/shared';

export function GenerateDocPage() {
  const navigate = useNavigate();
  const { listRecordings, listDocuments, getConfig, getRecording, generateDocuments } = useApi();

  const [recordings, setRecordings] = useState<RecordingSummary[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentTypeConfig[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<string>('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [documentTitle, setDocumentTitle] = useState('');
  const [guidance, setGuidance] = useState('');
  const [locale, setLocale] = useState('en-AU');
  const [selectedFolder, setSelectedFolder] = useState('Unfiled');
  const [folderOptions, setFolderOptions] = useState<string[]>(['Unfiled']);
  const [generating, setGenerating] = useState(false);
  const [generationStageIndex, setGenerationStageIndex] = useState(0);
  const [loadingRecordings, setLoadingRecordings] = useState(true);
  const [autofilling, setAutofilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTestCaseSuiteSelected = selectedTypes.includes('test_case_suite');
  const [testCaseContext, setTestCaseContext] = useState<TestCaseGenerationContext>({
    featureName: '',
    targetPersona: '',
    acceptanceCriteria: '',
    environmentContext: '',
    riskLevel: '',
    outOfScope: '',
  });
  const selectedRecordingSummary = useMemo(
    () => recordings.find((recording) => getRecordingSelectionId(recording) === selectedRecording) || null,
    [recordings, selectedRecording],
  );
  const generationStages = useMemo(
    () => [
      'Preparing generation request',
      'Sending recording context to the AI provider',
      `Drafting ${selectedTypes.length || 1} document${selectedTypes.length === 1 ? '' : 's'}`,
      'Finishing output and saving documents',
    ],
    [selectedTypes.length],
  );

  useEffect(() => {
    setLoadingRecordings(true);
    listRecordings({ pageSize: 100 })
      .then((res: PaginatedResponse<RecordingSummary>) => setRecordings(res.items))
      .catch(console.error)
      .finally(() => setLoadingRecordings(false));

    listDocuments({ page: 1, pageSize: 500 })
      .then((res) => {
        const discovered = new Set<string>(['Unfiled']);
        for (const doc of res.items || []) {
          const folder = String(doc.folder || '').trim();
          if (folder) discovered.add(folder);
        }
        setFolderOptions(Array.from(discovered).sort((a, b) => a.localeCompare(b)));
      })
      .catch(console.error);

    getConfig()
      .then((config: SystemConfig) => {
        const active = config.documentTypes.filter((dt) => dt.isActive);
        setDocTypes(active);
        for (const folder of config.folderConfigs || []) {
          const name = String(folder.displayName || folder.key || '').trim();
          if (!name) continue;
          setFolderOptions((prev) => (prev.includes(name) ? prev : [...prev, name]));
        }
      })
      .catch(console.error);
  }, [listRecordings, listDocuments, getConfig]);

  useEffect(() => {
    if (!generating) {
      setGenerationStageIndex(0);
      return;
    }

    setGenerationStageIndex(0);
    const timer = window.setInterval(() => {
      setGenerationStageIndex((prev) => Math.min(prev + 1, generationStages.length - 1));
    }, 2200);

    return () => window.clearInterval(timer);
  }, [generating, generationStages.length]);

  const toggleDocType = (key: string) => {
    setSelectedTypes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleGenerate = async () => {
    if (!selectedRecording || selectedTypes.length === 0 || !documentTitle.trim()) {
      setError('Please select a recording, at least one document type, and enter a title.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const result = await generateDocuments({
        recordingId: selectedRecording,
        documentTypes: selectedTypes,
        documentTitle: documentTitle.trim(),
        guidance: guidance.trim() || undefined,
        locale,
        folder: selectedFolder,
        testCaseContext: isTestCaseSuiteSelected ? sanitizeTestCaseContext(testCaseContext) : undefined,
      });

      // Navigate to first generated document
      if (result.length > 0) {
        navigate(`/app/documents/${result[0].documentId}`);
      } else {
        navigate('/app/documents');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleAutoFill = async () => {
    if (!selectedRecording) {
      setError('Select a recording before using auto-fill.');
      return;
    }
    if (selectedTypes.length === 0) {
      setError('Select at least one document type before using auto-fill.');
      return;
    }

    setAutofilling(true);
    setError(null);
    try {
      const recording = await getRecording(selectedRecording);
      const featureName = inferFeatureName(recording, selectedRecordingSummary);
      const primaryType = selectedTypes[0] || '';

      setDocumentTitle(buildSuggestedTitle(featureName, primaryType, selectedTypes.length));
      setGuidance(buildSuggestedGuidance(recording, featureName, primaryType));

      if (isTestCaseSuiteSelected) {
        setTestCaseContext({
          featureName,
          targetPersona: inferPersona(recording.metadata.productArea),
          acceptanceCriteria: inferAcceptanceCriteria(recording, featureName),
          environmentContext: inferEnvironment(recording),
          riskLevel: inferRiskLevel(recording),
          outOfScope: inferOutOfScope(recording),
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to auto-fill from the selected recording');
    } finally {
      setAutofilling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generate Documentation</h1>
        <p className="text-muted-foreground mt-1">
          Select a recording and choose which documents to generate.
        </p>
      </div>

      <div className="grid gap-6 max-w-3xl">
        {/* Step 1: Select Recording */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Select Recording</CardTitle>
            <CardDescription>
              Choose which recording to use as the source for documentation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRecordings ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                <Spinner className="h-4 w-4 text-primary" />
                Loading recordings...
              </div>
            ) : recordings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recordings found. Upload a recording first.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin-subtle pr-1">
                {recordings.map((rec) => (
                  <button
                    key={getRecordingSelectionId(rec)}
                    type="button"
                    onClick={() => setSelectedRecording(getRecordingSelectionId(rec))}
                    className={`w-full text-left p-3 rounded-md border text-sm transition-colors ${
                      selectedRecording === getRecordingSelectionId(rec)
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <div className="font-medium">{rec.metadata.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {rec.metadata.productArea} &middot;{' '}
                      {rec.eventCount} events &middot;{' '}
                      {new Date(rec.metadata.createdAtUtc).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Document Types */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Document Types</CardTitle>
            <CardDescription>
              Select one or more document types to generate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {docTypes.map((dt) => (
                <Badge
                  key={dt.key}
                  variant={selectedTypes.includes(dt.key) ? 'default' : 'outline'}
                  className="cursor-pointer px-3 py-1.5 text-sm"
                  onClick={() => toggleDocType(dt.key)}
                >
                  {dt.name}
                </Badge>
              ))}
            </div>
            {isTestCaseSuiteSelected ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Test Case Suite works best when guidance includes the feature goal, target user,
                acceptance criteria, known constraints, and any out-of-scope items.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Step 3: Details */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">3. Document Details</CardTitle>
                <CardDescription>
                  Auto-fill suggestions are derived from the selected recording and active document type.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleAutoFill()}
                disabled={!selectedRecording || selectedTypes.length === 0}
                loading={autofilling}
              >
                <Wand2 className="h-4 w-4" />
                Auto-fill
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="doc-title">Document Title *</Label>
              <Input
                id="doc-title"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="e.g. How to Create a Pickup Route"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="guidance">Guidance (optional)</Label>
              <Textarea
                id="guidance"
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                placeholder={
                  isTestCaseSuiteSelected
                    ? 'e.g. Feature goal: create a route plan. Target user: dispatcher. Acceptance criteria: user can create, validate, and save a route without ambiguity. Constraints: UAT environment, role-based access. Out of scope: reporting.'
                    : 'e.g. Focus on the multi-day planning workflow. Target audience: waste operators.'
                }
                className="mt-1"
                rows={3}
              />
              {isTestCaseSuiteSelected ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Include customer expectations here if you want stronger UAT coverage.
                </p>
              ) : null}
            </div>
            {isTestCaseSuiteSelected ? (
              <div className="space-y-4 rounded-md border border-border/70 bg-muted/20 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Structured Test Case Inputs</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    These fields improve coverage quality and make UAT output more grounded.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="feature-name">Feature / Module</Label>
                    <Input
                      id="feature-name"
                      value={testCaseContext.featureName || ''}
                      onChange={(e) => setTestCaseContext((prev) => ({ ...prev, featureName: e.target.value }))}
                      placeholder="e.g. Reasons configuration"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="target-persona">Target Persona</Label>
                    <Input
                      id="target-persona"
                      value={testCaseContext.targetPersona || ''}
                      onChange={(e) => setTestCaseContext((prev) => ({ ...prev, targetPersona: e.target.value }))}
                      placeholder="e.g. Dispatcher or BC admin"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="environment-context">Environment Context</Label>
                    <Input
                      id="environment-context"
                      value={testCaseContext.environmentContext || ''}
                      onChange={(e) => setTestCaseContext((prev) => ({ ...prev, environmentContext: e.target.value }))}
                      placeholder="e.g. UAT, role-based access enabled"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="risk-level">Risk Level</Label>
                    <select
                      id="risk-level"
                      value={testCaseContext.riskLevel || ''}
                      onChange={(e) => setTestCaseContext((prev) => ({ ...prev, riskLevel: e.target.value }))}
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Select risk level</option>
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="acceptance-criteria">Acceptance Criteria</Label>
                  <Textarea
                    id="acceptance-criteria"
                    value={testCaseContext.acceptanceCriteria || ''}
                    onChange={(e) => setTestCaseContext((prev) => ({ ...prev, acceptanceCriteria: e.target.value }))}
                    placeholder="e.g. User can create, validate, and save a reason without duplicate codes or unclear validation."
                    rows={3}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="out-of-scope">Out of Scope</Label>
                  <Textarea
                    id="out-of-scope"
                    value={testCaseContext.outOfScope || ''}
                    onChange={(e) => setTestCaseContext((prev) => ({ ...prev, outOfScope: e.target.value }))}
                    placeholder="e.g. Reporting, downstream integrations, bulk import"
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              <div>
                <Label htmlFor="locale">Locale</Label>
                <Input
                  id="locale"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  placeholder="en-AU"
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <Label htmlFor="folder">Folder</Label>
                <select
                  id="folder"
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {folderOptions
                    .slice()
                    .sort((a, b) => a.localeCompare(b))
                    .map((folder) => (
                      <option key={folder} value={folder}>
                        {folder}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error & Submit */}
        {error && (
          <div className="text-sm text-destructive">{error}</div>
        )}

        {generating ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-start gap-3 p-4">
              <Spinner className="mt-0.5 h-4 w-4 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Generating documentation</p>
                <p className="text-sm text-muted-foreground">
                  {generationStages[generationStageIndex]}
                </p>
                <p className="text-xs text-muted-foreground">
                  This can take a little longer for larger recordings or multiple document types.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Button
          onClick={handleGenerate}
          disabled={generating}
          size="lg"
          className="w-full"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Documentation
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function getRecordingSelectionId(recording: RecordingSummary): string {
  return recording.recordingId || recording.metadata.recordingId || '';
}

function sanitizeTestCaseContext(
  context: TestCaseGenerationContext,
): TestCaseGenerationContext | undefined {
  const next = Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, String(value || '').trim()]),
  ) as TestCaseGenerationContext;

  return Object.values(next).some((value) => value && value.length > 0) ? next : undefined;
}

function inferFeatureName(
  recording: RecordingDocument,
  summary: RecordingSummary | null,
): string {
  const raw =
    recording.metadata.name ||
    summary?.metadata.name ||
    recording.metadata.recordingId ||
    'Captured workflow';

  return raw
    .replace(/\b(recording|walkthrough|capture|demo)\b/gi, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Captured workflow';
}

function buildSuggestedTitle(featureName: string, primaryType: string, selectedCount: number): string {
  if (selectedCount > 1) return featureName;

  switch (primaryType) {
    case 'tutorial':
      return `${featureName} Tutorial`;
    case 'user_reference':
      return `${featureName} Reference Guide`;
    case 'release_notes':
      return `${featureName} Release Notes`;
    case 'test_case_suite':
      return `${featureName} Test Case Suite`;
    default:
      return featureName;
  }
}

function buildSuggestedGuidance(
  recording: RecordingDocument,
  featureName: string,
  primaryType: string,
): string {
  const productArea = recording.metadata.productArea || 'Web App';
  const environment = recording.metadata.environment ? ` Environment: ${recording.metadata.environment}.` : '';

  if (primaryType === 'test_case_suite') {
    return `Focus on ${featureName}. Target feature area: ${productArea}.${environment} Include realistic negative scenarios, validation behaviour, error handling, and user-facing clarity checks.`;
  }

  if (primaryType === 'tutorial') {
    return `Focus on the observed ${featureName} workflow. Keep steps aligned to the recorded sequence and use precise UI references relevant to ${productArea}.${environment}`;
  }

  if (primaryType === 'user_reference') {
    return `Document the ${featureName} capability for ${productArea}. Describe the visible screens, controls, and workflow states without inventing unsupported behaviour.${environment}`;
  }

  if (primaryType === 'release_notes') {
    return `Summarize the observed ${featureName} changes or capability in concise release-note language for ${productArea}.${environment}`;
  }

  return `Focus on ${featureName} in ${productArea}.${environment}`;
}

function inferPersona(productArea?: string): string {
  const normalized = String(productArea || '').toLowerCase();
  if (normalized.includes('admin')) return 'Platform administrator';
  if (normalized.includes('customer')) return 'Customer portal user';
  if (normalized.includes('marketing')) return 'Marketing team member';
  if (normalized.includes('developer')) return 'Developer';
  if (normalized.includes('api')) return 'Integration developer';
  if (normalized.includes('mobile')) return 'Mobile web user';
  if (normalized.includes('web')) return 'Web application user';
  return 'Product team member';
}

function inferEnvironment(recording: RecordingDocument): string {
  const parts = [
    recording.metadata.environment ? `Environment: ${recording.metadata.environment}` : '',
    recording.metadata.productName ? `Application: ${recording.metadata.productName}` : '',
    recording.metadata.applicationVersion ? `Version: ${recording.metadata.applicationVersion}` : '',
  ].filter(Boolean);

  return parts.join(' | ');
}

function inferAcceptanceCriteria(recording: RecordingDocument, featureName: string): string {
  const hasInput = recording.events.some((event) => event.type === 'input');
  const hasClick = recording.events.some((event) => event.type === 'click');
  const hasNavigation = recording.events.some((event) => event.type === 'navigation');

  const actions: string[] = [];
  if (hasNavigation) actions.push(`open ${featureName}`);
  if (hasClick) actions.push('complete the observed interaction flow');
  if (hasInput) actions.push('enter and update the required fields');

  const actionText =
    actions.length > 0 ? actions.join(', ') : `complete the ${featureName} workflow`;

  return `User can ${actionText} without unclear system behaviour, blocking errors, or ambiguous validation feedback.`;
}

function inferRiskLevel(recording: RecordingDocument): string {
  const text = [
    recording.metadata.productArea,
    ...recording.events.map((event) => `${event.type} ${event.label || ''} ${event.fieldName || ''} ${event.description || ''}`),
  ]
    .join(' ')
    .toLowerCase();

  if (/(save|create|delete|permission|validation|required|error|duplicate)/.test(text)) {
    return 'High';
  }

  if (/(configure|setup|integration|billing|payment|role)/.test(text)) {
    return 'Medium';
  }

  return 'Low';
}

function inferOutOfScope(recording: RecordingDocument): string {
  const text = [
    recording.metadata.productArea,
    ...recording.events.map((event) => `${event.type} ${event.label || ''} ${event.description || ''} ${event.url || ''}`),
  ]
    .join(' ')
    .toLowerCase();

  const items: string[] = [];

  if (!/(report|dashboard|analytics)/.test(text)) {
    items.push('Reporting and analytics');
  }
  if (!/(integration|api|webhook|sync)/.test(text)) {
    items.push('External integrations');
  }
  if (!/(permission|role|security|access)/.test(text)) {
    items.push('Role and permission management');
  }
  if (!/(import|export|bulk)/.test(text)) {
    items.push('Bulk import and export flows');
  }

  return items.join(', ');
}


