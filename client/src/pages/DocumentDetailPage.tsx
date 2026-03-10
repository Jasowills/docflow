import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import { useApi } from '../hooks/use-api';
import { useClientDataStore } from '../state/client-data-store';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { ArrowLeft, ChevronDown, Copy, Download, Trash2, Clock3, Languages, FolderKanban, FolderOpen } from 'lucide-react';
import type { GeneratedDocument } from '@docflow/shared';

function preferFullScreenshotUrl(src?: string): string {
  if (!src) return '';
  return src.replace(/-thumb\.jpg(\?.*)?$/i, '.jpg$1');
}

type TestCaseRecord = {
  id: string;
  sectionTitle?: string;
  title: string;
  objective: string;
  preconditions: string;
  steps: string;
  expectedResult: string;
  priority: string;
  evidenceNotes: string;
};

type TestCaseSection = {
  title: string;
  cases: TestCaseRecord[];
};

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { getDocument, deleteDocument, moveDocumentToFolder, listDocuments, getConfig } = useApi();
  const { evictDocument, resetDocumentsLists } = useClientDataStore();
  const [doc, setDoc] = useState<GeneratedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [folderInput, setFolderInput] = useState('Unfiled');
  const [folderOptions, setFolderOptions] = useState<string[]>(['Unfiled']);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const sourceFolder = String((location.state as { folderFilter?: string } | null)?.folderFilter || '').trim();
  const docTypeLabels: Record<string, string> = {
    user_reference: 'User Reference',
    tutorial: 'Tutorial',
    test_case_suite: 'Test Case Suite',
    release_notes: 'Release Notes',
  };
  const testCaseSections = useMemo(
    () =>
      doc?.documentType === 'test_case_suite' ? parseTestCaseSuite(doc.content) : [],
    [doc],
  );
  const flatTestCases = useMemo(
    () =>
      testCaseSections.flatMap((section) =>
        section.cases.map((testCase) => ({ ...testCase, sectionTitle: section.title })),
      ),
    [testCaseSections],
  );
  const isTestCaseSuite = doc?.documentType === 'test_case_suite' && testCaseSections.length > 0;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getDocument(id)
      .then((loaded) => {
        setDoc(loaded);
        setFolderInput((loaded.folder || 'Unfiled').trim() || 'Unfiled');
      })
      .catch((err) => {
        console.error(err);
        navigate('/app/documents');
      })
      .finally(() => setLoading(false));
  }, [id, getDocument, navigate]);

  useEffect(() => {
    Promise.all([listDocuments({ page: 1, pageSize: 500 }), getConfig()])
      .then(([result, config]) => {
        const unique = new Map<string, string>([['unfiled', 'Unfiled']]);
        for (const item of result.items || []) {
          const folder = String(item.folder || '').trim();
          if (folder) unique.set(normalizeFolderOptionKey(folder), folder);
        }
        for (const folderConfig of config.folderConfigs || []) {
          const folder = String(folderConfig.displayName || folderConfig.key || '').trim();
          if (folder) unique.set(normalizeFolderOptionKey(folder), folder);
        }
        setFolderOptions(Array.from(unique.values()).sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => {
        setFolderOptions(['Unfiled']);
      });
  }, [listDocuments, getConfig]);

  useEffect(() => {
    if (testCaseSections.length === 0) return;
    setCollapsedSections((prev) => {
      const next: Record<string, boolean> = {};
      for (const section of testCaseSections) {
        next[section.title] = prev[section.title] ?? false;
      }
      return next;
    });
  }, [testCaseSections]);

  const handleCopy = async () => {
    if (!doc) return;
    await navigator.clipboard.writeText(doc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMd = () => {
    if (!doc) return;
    const blob = new Blob([doc.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.documentTitle.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (!doc || !isTestCaseSuite || flatTestCases.length === 0) return;
    const csv = buildAzureDevOpsCsv(flatTestCases, doc);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.documentTitle.replace(/\s+/g, '_')}_azure_devops.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!doc) return;
    setIsDeleting(true);
    try {
      await deleteDocument(doc.documentId);
      evictDocument(doc.documentId);
      navigate('/app/documents');
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleSaveFolder = async () => {
    if (!doc) return;
    const nextFolder = folderInput.trim();
    if (!nextFolder) return;
    setIsSavingFolder(true);
    try {
      const updated = await moveDocumentToFolder(doc.documentId, nextFolder);
      setDoc(updated);
      setFolderInput((updated.folder || 'Unfiled').trim() || 'Unfiled');
      resetDocumentsLists();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingFolder(false);
    }
  };

  const toggleSection = (sectionTitle: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading document...</p>
      </div>
    );
  }

  if (!doc) return null;

  const markdownComponents: Components = {
    h1: ({ children }) => <h1 className="doc-h1">{children}</h1>,
    h2: ({ children }) => <h2 className="doc-h2">{children}</h2>,
    h3: ({ children }) => <h3 className="doc-h3">{children}</h3>,
    p: ({ children }) => <p className="doc-p">{children}</p>,
    ul: ({ children }) => <ul className="doc-ul">{children}</ul>,
    ol: ({ children }) => <ol className="doc-ol">{children}</ol>,
    li: ({ children }) => <li className="doc-li">{children}</li>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noreferrer" className="doc-link">
        {children}
      </a>
    ),
    img: ({ src, alt }) => (
      <img
        src={preferFullScreenshotUrl(src)}
        alt={alt || 'Screenshot'}
        className="doc-img my-3 block max-w-full h-auto rounded-md border"
        loading="lazy"
      />
    ),
    blockquote: ({ children }) => <blockquote className="doc-blockquote">{children}</blockquote>,
    hr: () => <hr className="doc-hr" />,
    code(props) {
      const { children, className, ...rest } = props;
      const isBlock = !!className;
      if (isBlock) {
        return (
          <code {...rest} className="doc-code-block">
            {children}
          </code>
        );
      }
      return (
        <code {...rest} className="doc-code-inline">
          {children}
        </code>
      );
    },
    pre: ({ children }) => <pre className="doc-pre">{children}</pre>,
    table: ({ children }) => (
      <div className="doc-table-wrap">
        <table className="doc-table">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="doc-thead">{children}</thead>,
    tbody: ({ children }) => <tbody className="doc-tbody">{children}</tbody>,
    tr: ({ children }) => <tr className="doc-tr">{children}</tr>,
    th: ({ children }) => <th className="doc-th">{children}</th>,
    td: ({ children }) => <td className="doc-td">{children}</td>,
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button
            onClick={() =>
              navigate('/app/documents', {
                state: sourceFolder ? { folderFilter: sourceFolder } : undefined,
              })
            }
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {sourceFolder ? `Back to ${sourceFolder}` : 'Back to documents'}
          </button>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{doc.documentTitle}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
            <Badge variant="secondary">
              {docTypeLabels[doc.documentType] || doc.documentType}
            </Badge>
            <span className="text-sm text-muted-foreground">{doc.productArea}</span>
            <Badge variant="outline">{doc.folder || 'Unfiled'}</Badge>
            <span className="text-sm text-muted-foreground">{new Date(doc.createdAtUtc).toLocaleString()}</span>
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:justify-end lg:gap-2 lg:shrink-0">
          <Button variant="outline" size="sm" onClick={handleCopy} className="w-full lg:w-auto">
            <Copy className="h-4 w-4 mr-1" />
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          {isTestCaseSuite ? (
            <Button variant="outline" size="sm" onClick={handleExportCsv} className="w-full lg:w-auto">
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleDownloadMd} className="w-full lg:w-auto">
            <Download className="h-4 w-4 mr-1" />
            Download .md
          </Button>
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isDeleting} className="w-full lg:w-auto">
                <Trash2 className="h-4 w-4 mr-1" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete document?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this document and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleDelete()} disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div
        className={
          isTestCaseSuite
            ? 'grid grid-cols-1 gap-4 md:gap-5'
            : 'grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,1fr)_280px]'
        }
      >
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {isTestCaseSuite ? (
              <article className="doc-article">
                <header className="test-suite-header">
                  <div>
                    <p className="test-suite-eyebrow">Structured Test Coverage</p>
                    <h2 className="test-suite-title">{doc.documentTitle}</h2>
                    <p className="test-suite-summary">
                      Functional, UI/UX, and UAT test cases organized for review.
                    </p>
                  </div>
                  <div className="test-suite-counts">
                    {testCaseSections.map((section) => (
                      <div key={section.title} className="test-suite-count-card">
                        <span className="test-suite-count-value">{section.cases.length}</span>
                        <span className="test-suite-count-label">{section.title}</span>
                      </div>
                    ))}
                  </div>
                </header>

                <div className="test-suite-sections">
                  {testCaseSections.map((section) => (
                    <section key={section.title} className="test-suite-section-block">
                      <button
                        type="button"
                        className="test-suite-section-header test-suite-section-toggle"
                        onClick={() => toggleSection(section.title)}
                        aria-expanded={!collapsedSections[section.title]}
                      >
                        <div className="test-suite-section-header-main">
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              collapsedSections[section.title] ? '-rotate-90' : 'rotate-0'
                            }`}
                          />
                          <div>
                            <h3 className="test-suite-section-title">{section.title}</h3>
                            <p className="test-suite-section-count">
                              {section.cases.length} case{section.cases.length === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>
                      </button>

                      {!collapsedSections[section.title] ? (
                        <div className="test-suite-card-list">
                          {section.cases.map((testCase) => (
                            <article key={testCase.id} className="test-case-card">
                              <div className="test-case-card-header">
                                <h4 className="test-case-title-line">
                                  <span className="test-case-id-badge">{testCase.id}</span>
                                  <span className="test-case-title-separator">—</span>
                                  <span className="test-case-title">{stripMarkdown(testCase.title)}</span>
                                </h4>
                              </div>
                              <div className="test-case-fields">
                                <TestCaseInlineField label="Category" value={section.title.replace(' Test Cases', '')} />
                                <TestCaseInlineField
                                  label="Priority"
                                  value={testCase.priority || 'Unspecified'}
                                  priorityTone={toPriorityTone(testCase.priority)}
                                />
                                <TestCaseField label="Preconditions" value={testCase.preconditions} />
                                <TestCaseField label="Test Data" value="" hidden />
                                <TestCaseStepsField
                                  steps={testCase.steps}
                                  expectedResult={testCase.expectedResult}
                                />
                                <TestCaseField label="Evidence / Notes" value={testCase.evidenceNotes} tone="muted" />
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ))}
                </div>
              </article>
            ) : (
              <article className="doc-article">
                <ReactMarkdown
                  components={markdownComponents}
                  urlTransform={(url) => {
                    if (!url) return url;
                    if (url.startsWith('data:image/')) return url;
                    return url;
                  }}
                >
                  {doc.content}
                </ReactMarkdown>
              </article>
            )}
          </CardContent>
        </Card>

        <Card className={isTestCaseSuite ? 'h-fit' : 'h-fit xl:sticky xl:top-24'}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Document Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <FolderKanban className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Recording</p>
                <p>{doc.recordingName}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Languages className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Locale</p>
                <p>{doc.locale}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FolderOpen className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="w-full space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Folder</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={folderInput}
                    onChange={(event) => setFolderInput(event.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {folderOptions.map((folder) => (
                      <option key={folder} value={folder}>
                        {folder}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleSaveFolder()}
                    disabled={isSavingFolder || !folderInput.trim() || folderInput.trim() === (doc.folder || 'Unfiled')}
                  >
                    {isSavingFolder ? 'Saving...' : 'Move'}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock3 className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Generated</p>
                <p>{new Date(doc.createdAtUtc).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TestCaseInlineField({
  label,
  value,
  priorityTone,
}: {
  label: string;
  value: string;
  priorityTone?: 'high' | 'medium' | 'low' | 'default';
}) {
  if (!value.trim()) return null;
  return (
    <p className="test-case-inline-field">
      <span className="test-case-inline-label">{label}:</span>{' '}
      {label === 'Priority' ? (
        <span className={`test-case-priority test-case-priority-${priorityTone || 'default'}`}>
          {stripMarkdown(value)}
        </span>
      ) : (
        <span>{stripMarkdown(value)}</span>
      )}
    </p>
  );
}

function TestCaseField({
  label,
  value,
  tone = 'default',
  hidden = false,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'muted';
  hidden?: boolean;
}) {
  if (hidden || !normalizeCellMarkdown(value).trim()) return null;
  return (
    <div className={`test-case-field ${tone === 'muted' ? 'test-case-field-muted' : ''}`}>
      <p className="test-case-field-label">{label}</p>
      <div className="test-case-field-value">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p>{children}</p>,
            ul: ({ children }) => <ul>{children}</ul>,
            ol: ({ children }) => <ol>{children}</ol>,
            li: ({ children }) => <li>{children}</li>,
            strong: ({ children }) => <strong>{children}</strong>,
            em: ({ children }) => <em>{children}</em>,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noreferrer" className="doc-link">
                {children}
              </a>
            ),
            img: () => null,
          }}
        >
          {normalizeCellMarkdown(value)}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function TestCaseStepsField({
  steps,
  expectedResult,
}: {
  steps: string;
  expectedResult: string;
}) {
  const pairs = parseStepExpectedPairs(steps, expectedResult);

  if (pairs.length === 0) return null;

  return (
    <div className="test-case-field">
      <p className="test-case-field-label">Steps:</p>
      <ol className="test-case-steps">
        {pairs.map((pair, index) => (
          <li key={`${index}-${pair.action}`} className="test-case-step-item">
            <div className="test-case-step-action">{index + 1}. {pair.action}</div>
            {pair.expected ? (
              <div className="test-case-step-expected">
                <div className="test-case-step-expected-label">Expected Result</div>
                <div className="test-case-step-expected-text">{pair.expected}</div>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function parseStepExpectedPairs(
  steps: string,
  expectedResult: string,
): Array<{ action: string; expected: string }> {
  const normalizedSteps = normalizeCellMarkdown(steps);
  const normalizedExpected = normalizeCellMarkdown(expectedResult);
  const rawStepLines = normalizedSteps
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const stepLines = expandInlineExpectedResults(rawStepLines);

  const inlinePairs: Array<{ action: string; expected: string }> = [];
  let currentPair: { action: string; expected: string } | null = null;

  for (const line of stepLines) {
    if (/^\d+\.\s+/.test(line)) {
      if (currentPair) {
        inlinePairs.push(currentPair);
      }
      currentPair = {
        action: line.replace(/^\d+\.\s*/, '').trim(),
        expected: '',
      };
      continue;
    }

    if (/^expected result\s*:/i.test(line)) {
      if (currentPair) {
        currentPair.expected = line.replace(/^expected result\s*:\s*/i, '').trim();
      }
      continue;
    }

    if (currentPair) {
      currentPair.action = `${currentPair.action} ${line}`.trim();
    }
  }

  if (currentPair) {
    inlinePairs.push(currentPair);
  }

  if (inlinePairs.length > 0) {
    return inlinePairs;
  }

  const actions = stepLines;
  const results = normalizedExpected
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return actions.map((action, index) => ({
    action: action.replace(/^\d+\.\s*/, ''),
    expected: (results[index] || '').replace(/^\d+\.\s*/, ''),
  }));
}

function expandInlineExpectedResults(lines: string[]): string[] {
  const expanded: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(\d+\.\s+.*?)(?:\s+Expected Result:\s*)(.+)$/i);
    if (match) {
      expanded.push(match[1].trim());
      expanded.push(`Expected Result: ${match[2].trim()}`);
      continue;
    }

    expanded.push(line);
  }

  return expanded;
}

function normalizeCellMarkdown(value: string): string {
  return (value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMarkdown(value: string): string {
  return normalizeCellMarkdown(value).replace(/\n+/g, ' ');
}

function parseTestCaseSuite(content: string): TestCaseSection[] {
  const lines = content.split(/\r?\n/);
  const sections: TestCaseSection[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line.startsWith('## ')) {
      index += 1;
      continue;
    }

    const title = line.replace(/^##\s+/, '').trim();
    index += 1;

    while (index < lines.length && !lines[index].trim().startsWith('|')) {
      if (lines[index].trim().startsWith('## ')) {
        break;
      }
      index += 1;
    }

    const tableLines: string[] = [];
    while (index < lines.length && lines[index].trim().startsWith('|')) {
      tableLines.push(lines[index]);
      index += 1;
    }

    const parsed = dedupeTestCaseTitles(parseMarkdownTable(tableLines));
    if (parsed.length > 0) {
      sections.push({ title, cases: parsed });
    }
  }

  return sections;
}

function parseMarkdownTable(lines: string[]): TestCaseRecord[] {
  if (lines.length < 3) return [];

  const rows = lines
    .map(splitMarkdownRow)
    .filter((row) => row.length > 0);

  if (rows.length < 3) return [];

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const bodyRows = rows.slice(2);

  return bodyRows.map((row) => {
    const get = (columnName: string) => {
      const index = header.indexOf(columnName);
      return index >= 0 ? row[index] || '' : '';
    };

    return {
      id: get('test case id'),
      title: get('title'),
      objective: get('objective'),
      preconditions: get('preconditions'),
      steps: get('steps'),
      expectedResult: get('expected result'),
      priority: get('priority'),
      evidenceNotes: get('evidence / notes'),
    };
  });
}

function splitMarkdownRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return [];
  return trimmed
    .slice(1, trimmed.endsWith('|') ? -1 : undefined)
    .split('|')
    .map((cell) => cell.trim());
}

function toPriorityTone(priority: string): 'high' | 'medium' | 'low' | 'default' {
  const normalized = (priority || '').trim().toLowerCase();
  if (normalized === 'high' || normalized === 'critical') return 'high';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'low') return 'low';
  return 'default';
}

function dedupeTestCaseTitles(cases: TestCaseRecord[]): TestCaseRecord[] {
  const seen = new Map<string, number>();
  return cases.map((testCase) => {
    const key = stripMarkdown(testCase.title).trim().toLowerCase();
    const count = seen.get(key) || 0;
    seen.set(key, count + 1);
    if (count === 0) return testCase;
    return {
      ...testCase,
      title: `${stripMarkdown(testCase.title)} (${count + 1})`,
    };
  });
}

function buildAzureDevOpsCsv(
  testCases: TestCaseRecord[],
  doc: GeneratedDocument,
): string {
  const columns = [
    'ID',
    'Work Item Type',
    'Title',
    'Test Step',
    'Step Action',
    'Step Expected',
    'Area Path',
    'Assigned To',
    'State',
  ];

  const areaPath = 'marklite-routectrl\\Application Testing';
  const assignedTo = doc.createdByName || '';
  const state = 'Design';
  const rows: string[][] = [];

  for (const testCase of testCases) {
    const stepPairs = parseStepExpectedPairs(testCase.steps, testCase.expectedResult);
    const title = `${testCase.id} ${stripMarkdown(testCase.title)}`.trim();

    rows.push([
      '',
      'Test Case',
      title,
      '',
      '',
      '',
      areaPath,
      assignedTo,
      state,
    ]);

    if (stepPairs.length === 0) {
      rows.push([
        '',
        '',
        '',
        '1',
        '',
        normalizeCellMarkdown(testCase.expectedResult),
        '',
        '',
        '',
      ]);
      continue;
    }

    for (const [index, pair] of stepPairs.entries()) {
      rows.push([
        '',
        '',
        '',
        String(index + 1),
        pair.action.trim(),
        pair.expected.trim(),
        '',
        '',
        '',
      ]);
    }
  }

  return [columns, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\r\n');
}

function csvEscape(value: string): string {
  const normalized = String(value ?? '');
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function normalizeFolderOptionKey(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'unfiled';
  return trimmed
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

