import { useEffect, useRef, useState } from "react";
import { useApi } from "../hooks/use-api";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
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
} from "../components/ui/alert-dialog";
import { Settings, Save, Plus, Trash2, Check } from "lucide-react";
import type {
  SystemConfig,
  DocumentTypeConfig,
  UpsertDocumentTypeRequest,
  FolderConfig,
  UpsertFolderConfigRequest,
} from "@docflow/shared";

export function AdminConfigPage() {
  const {
    getConfig,
    listDocuments,
    updateGlobalPrompt,
    upsertDocumentType,
    deleteDocumentType,
    upsertFolderConfig,
    deleteFolderConfig,
    uploadFolderPreviewImage,
  } = useApi();

  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [globalPrompt, setGlobalPrompt] = useState("");
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [globalSaved, setGlobalSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // New/Edit doc type form
  const [editingType, setEditingType] = useState<DocumentTypeConfig | null>(
    null,
  );
  const [typeForm, setTypeForm] = useState({
    key: "",
    name: "",
    description: "",
    systemPrompt: "",
    isActive: true,
    sortOrder: 99,
  });
  const [deleteTypeKey, setDeleteTypeKey] = useState<string | null>(null);
  const [savingType, setSavingType] = useState(false);
  const [deletingTypeKey, setDeletingTypeKey] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<FolderConfig | null>(null);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [folderForm, setFolderForm] = useState({
    folderName: "",
    tag: "",
    description: "",
    previewImageUrl: "",
  });
  const [deleteFolderKey, setDeleteFolderKey] = useState<string | null>(null);
  const [uploadingFolderImage, setUploadingFolderImage] = useState(false);
  const [existingFolders, setExistingFolders] = useState<string[]>([]);
  const [loadingExistingFolders, setLoadingExistingFolders] = useState(false);
  const [savingFolder, setSavingFolder] = useState(false);
  const [deletingFolderKey, setDeletingFolderKey] = useState<string | null>(null);
  const [folderFormScrollKey, setFolderFormScrollKey] = useState(0);
  const folderFormRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoadingConfig(true);
    getConfig()
      .then((cfg: SystemConfig) => {
        setConfig(cfg);
        setGlobalPrompt(cfg.globalSystemPrompt);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingConfig(false));
  }, [getConfig]);

  useEffect(() => {
    setLoadingExistingFolders(true);
    listDocuments({ page: 1, pageSize: 500 })
      .then((result) => {
        const hasUnfiledDocuments = (result.items || []).some((item) => {
          const folder = String(item.folder || "").trim();
          return folder.length === 0 || folder.toLowerCase() === "unfiled";
        });
        const values = Array.from(
          new Set([
            ...(result.items || [])
              .map((item) => (item.folder || "").trim())
              .filter((value) => value.length > 0),
            ...(hasUnfiledDocuments ? ["Unfiled"] : []),
          ]),
        ).sort((a, b) => a.localeCompare(b));
        setExistingFolders(values);
      })
      .catch(() => {
        setExistingFolders([]);
      })
      .finally(() => setLoadingExistingFolders(false));
  }, [listDocuments]);

  useEffect(() => {
    if (folderFormScrollKey === 0) return;
    const frame = window.requestAnimationFrame(() => {
      folderFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [folderFormScrollKey]);

  const handleSaveGlobalPrompt = async () => {
    setSavingGlobal(true);
    setError(null);
    try {
      const updated = await updateGlobalPrompt(globalPrompt);
      setConfig(updated);
      setGlobalSaved(true);
      setTimeout(() => setGlobalSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleEditType = (dt: DocumentTypeConfig) => {
    setEditingType(dt);
    setTypeForm({
      key: dt.key,
      name: dt.name,
      description: dt.description,
      systemPrompt: dt.systemPrompt,
      isActive: dt.isActive,
      sortOrder: dt.sortOrder,
    });
  };

  const handleNewType = () => {
    setEditingType(null);
    setTypeForm({
      key: "",
      name: "",
      description: "",
      systemPrompt: "",
      isActive: true,
      sortOrder: 99,
    });
  };

  const handleSaveType = async () => {
    if (!typeForm.key || !typeForm.name || !typeForm.systemPrompt) {
      setError("Key, name, and system prompt are required");
      return;
    }
    setError(null);
    setSavingType(true);
    try {
      const req: UpsertDocumentTypeRequest = {
        key: typeForm.key,
        name: typeForm.name,
        description: typeForm.description,
        systemPrompt: typeForm.systemPrompt,
        isActive: typeForm.isActive,
        sortOrder: typeForm.sortOrder,
      };
      const updated = await upsertDocumentType(req);
      setConfig(updated);
      setEditingType(null);
      setTypeForm({
        key: "",
        name: "",
        description: "",
        systemPrompt: "",
        isActive: true,
        sortOrder: 99,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingType(false);
    }
  };

  const handleDeleteType = async (key: string) => {
    setDeletingTypeKey(key);
    try {
      const updated = await deleteDocumentType(key);
      setConfig(updated);
      setDeleteTypeKey(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingTypeKey(null);
    }
  };

  const handleEditFolder = (folder: FolderConfig) => {
    setEditingFolder(folder);
    setShowFolderForm(true);
    setFolderForm({
      folderName: folder.displayName,
      tag: folder.tag || "",
      description: folder.description || "",
      previewImageUrl: folder.previewImageUrl || "",
    });
    setFolderFormScrollKey((prev) => prev + 1);
  };

  const handleNewFolder = () => {
    setEditingFolder(null);
    setShowFolderForm(true);
    setFolderForm({
      folderName: "",
      tag: "",
      description: "",
      previewImageUrl: "",
    });
    setFolderFormScrollKey((prev) => prev + 1);
  };

  const handleSaveFolder = async () => {
    if (!folderForm.folderName.trim()) {
      setError("Folder name is required");
      return;
    }
    if (!editingFolder && !folderForm.previewImageUrl) {
      setError("Please pick and upload a preview image");
      return;
    }
    setError(null);
    setSavingFolder(true);
    try {
      const normalizedName = folderForm.folderName.trim();
      const effectiveKey = editingFolder?.key || toFolderKey(normalizedName);
      const req: UpsertFolderConfigRequest = {
        key: effectiveKey,
        displayName: normalizedName,
        tag: folderForm.tag || undefined,
        description: folderForm.description || undefined,
        previewImageUrl: folderForm.previewImageUrl || undefined,
      };
      const updated = await upsertFolderConfig(req);
      setConfig(updated);
      setEditingFolder(null);
      setShowFolderForm(false);
      setFolderForm({
        folderName: "",
        tag: "",
        description: "",
        previewImageUrl: "",
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save folder");
    } finally {
      setSavingFolder(false);
    }
  };

  const handleDeleteFolder = async (key: string) => {
    setDeletingFolderKey(key);
    try {
      const updated = await deleteFolderConfig(key);
      setConfig(updated);
      setDeleteFolderKey(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete folder config");
    } finally {
      setDeletingFolderKey(null);
    }
  };

  const handleConfigureExistingFolder = (folderKey: string) => {
    const normalized = folderKey.trim();
    if (!normalized) return;
    setEditingFolder(null);
    setShowFolderForm(true);
    setFolderForm({
      folderName: toDisplayName(normalized),
      tag: "",
      description: `${toDisplayName(normalized)} documentation`,
      previewImageUrl: "",
    });
    setFolderFormScrollKey((prev) => prev + 1);
  };

  const handleFolderImagePicked = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }
    setError(null);
    setUploadingFolderImage(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const response = await uploadFolderPreviewImage(
        dataUrl,
        editingFolder?.key || toFolderKey(folderForm.folderName) || undefined,
      );
      setFolderForm((prev) => ({ ...prev, previewImageUrl: response.url }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploadingFolderImage(false);
    }
  };

  if (loadingConfig || !config) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Spinner className="text-primary" />
        <p>Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-7 w-7" />
          Admin Configuration
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage system prompts and document types for AI generation.
        </p>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </div>
      )}

      {/* Global System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Global System Prompt</CardTitle>
          <CardDescription>
            This prompt is prepended to all AI generation requests across all
            document types.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={globalPrompt}
            onChange={(e) => setGlobalPrompt(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          <Button onClick={handleSaveGlobalPrompt} disabled={savingGlobal}>
            {globalSaved ? (
              <>
                <Check className="h-4 w-4 mr-1" /> Saved
              </>
            ) : (
              <>
                {savingGlobal ? <Spinner className="mr-2" /> : null}
                <Save className="h-4 w-4 mr-1" /> Save Global Prompt
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Document Types */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Document Types</CardTitle>
              <CardDescription>
                Configure the available document types and their prompts.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleNewType}>
              <Plus className="h-4 w-4 mr-1" /> Add Type
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.documentTypes
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((dt) => (
              <div
                key={dt.key}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md border"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{dt.name}</span>
                    <Badge variant={dt.isActive ? "default" : "secondary"}>
                      {dt.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {dt.key}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dt.description}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditType(dt)}
                  >
                    Edit
                  </Button>
                  <AlertDialog
                    open={deleteTypeKey === dt.key}
                    onOpenChange={(open) =>
                      setDeleteTypeKey(open ? dt.key : null)
                    }
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={deletingTypeKey === dt.key}
                      >
                        {deletingTypeKey === dt.key ? <Spinner /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete document type?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove "{dt.key}" from available document types.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => void handleDeleteType(dt.key)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Edit/New Document Type Form */}
      {(editingType !== null ||
        typeForm.key !== "" ||
        typeForm.name !== "") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingType ? `Edit: ${editingType.name}` : "New Document Type"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Key (unique identifier)</Label>
                <Input
                  value={typeForm.key}
                  onChange={(e) =>
                    setTypeForm({ ...typeForm, key: e.target.value })
                  }
                  placeholder="e.g. test_case_suite"
                  disabled={!!editingType}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input
                  value={typeForm.name}
                  onChange={(e) =>
                    setTypeForm({ ...typeForm, name: e.target.value })
                  }
                  placeholder="e.g. Test Case Suite"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={typeForm.description}
                onChange={(e) =>
                  setTypeForm({ ...typeForm, description: e.target.value })
                }
                placeholder="Brief description of this document type"
                className="mt-1"
              />
            </div>
            <div>
              <Label>System Prompt</Label>
              <Textarea
                value={typeForm.systemPrompt}
                onChange={(e) =>
                  setTypeForm({ ...typeForm, systemPrompt: e.target.value })
                }
                rows={6}
                className="mt-1 font-mono text-sm"
                placeholder="Instructions for the AI when generating this document type..."
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={typeForm.isActive}
                  onChange={(e) =>
                    setTypeForm({ ...typeForm, isActive: e.target.checked })
                  }
                />
                Active
              </label>
              <div className="flex items-center gap-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={typeForm.sortOrder}
                  onChange={(e) =>
                    setTypeForm({
                      ...typeForm,
                      sortOrder: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-20"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveType} disabled={savingType}>
                {savingType ? <Spinner className="mr-2" /> : null}
                <Save className="h-4 w-4 mr-1" /> Save Document Type
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingType(null);
                  setTypeForm({
                    key: "",
                    name: "",
                    description: "",
                    systemPrompt: "",
                    isActive: true,
                    sortOrder: 99,
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Folder Card Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Folders</CardTitle>
              <CardDescription>
                Configure folder name, tag, subtitle text, and preview image used on the Documents page.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleNewFolder}>
              <Plus className="h-4 w-4 mr-1" /> Add Folder
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingExistingFolders ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="text-primary" />
              Loading existing folders...
            </div>
          ) : null}
          {existingFolders.filter((folder) => !isFolderConfigured(folder, config.folderConfigs || [])).length > 0 ? (
            <div className="rounded-md border border-dashed p-3">
              <p className="text-sm font-medium">Existing folders found in documents</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {existingFolders
                  .filter((folder) => !isFolderConfigured(folder, config.folderConfigs || []))
                  .map((folder) => (
                    <Button
                      key={folder}
                      variant="outline"
                      size="sm"
                      onClick={() => handleConfigureExistingFolder(folder)}
                    >
                      Configure {toDisplayName(folder)}
                    </Button>
                  ))}
              </div>
            </div>
          ) : null}
          {(config.folderConfigs || [])
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
            .map((folder) => (
              <div
                key={folder.key}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md border"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{folder.displayName}</span>
                    {folder.tag ? (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        {folder.tag}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{folder.description || "No subtitle configured"}</p>
                  {folder.previewImageUrl ? (
                    <div className="space-y-1">
                      <img
                        src={folder.previewImageUrl}
                        alt={`${folder.displayName} preview`}
                        className="h-16 w-32 rounded-md border object-cover"
                        loading="lazy"
                      />
                      <p className="text-xs text-muted-foreground truncate max-w-[440px]">
                        {folder.previewImageUrl}
                      </p>
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEditFolder(folder)}>
                    Edit
                  </Button>
                  <AlertDialog
                    open={deleteFolderKey === folder.key}
                    onOpenChange={(open) => setDeleteFolderKey(open ? folder.key : null)}
                  >
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive" disabled={deletingFolderKey === folder.key}>
                        {deletingFolderKey === folder.key ? <Spinner /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete folder config?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes UI customizations for "{folder.key}".
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleDeleteFolder(folder.key)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Edit/New Folder Config Form */}
      {(showFolderForm ||
        editingFolder !== null ||
        folderForm.folderName !== "") && (
        <Card ref={folderFormRef}>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingFolder ? `Edit Folder: ${editingFolder.displayName}` : "New Folder"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Folder Name</Label>
              <Input
                value={folderForm.folderName}
                onChange={(e) => setFolderForm({ ...folderForm, folderName: e.target.value })}
                placeholder="e.g. Applications"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tag</Label>
              <Input
                value={folderForm.tag}
                onChange={(e) => setFolderForm({ ...folderForm, tag: e.target.value })}
                placeholder="e.g. D365BC"
                className="mt-1 max-w-xs"
              />
            </div>
            <div>
              <Label>Subtitle</Label>
              <Input
                value={folderForm.description}
                onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                placeholder="e.g. Product documentation workspace"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Preview Image</Label>
              <div className="mt-1 flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleFolderImagePicked(e.target.files?.[0] || null)}
                  className="max-w-sm"
                />
                {uploadingFolderImage ? (
                  <span className="text-xs text-muted-foreground">Uploading...</span>
                ) : null}
              </div>
              {folderForm.previewImageUrl ? (
                <div className="mt-3 space-y-2">
                  <img
                    src={folderForm.previewImageUrl}
                    alt="Folder preview"
                    className="h-20 w-36 rounded-md border object-cover"
                    loading="lazy"
                  />
                  <p className="text-xs text-muted-foreground truncate max-w-[440px]">
                    {folderForm.previewImageUrl}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No image uploaded yet.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveFolder} disabled={savingFolder}>
                {savingFolder ? <Spinner className="mr-2" /> : null}
                <Save className="h-4 w-4 mr-1" /> Save Folder
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingFolder(null);
                  setShowFolderForm(false);
                  setFolderForm({
                    folderName: "",
                    tag: "",
                    description: "",
                    previewImageUrl: "",
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
        return;
      }
      reject(new Error("Failed to read selected image"));
    };
    reader.onerror = () => reject(new Error("Failed to read selected image"));
    reader.readAsDataURL(file);
  });
}

function toDisplayName(value: string): string {
  const cleaned = value.replace(/[_-]+/g, " ").trim();
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function toFolderKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isFolderConfigured(folderName: string, configs: FolderConfig[]): boolean {
  const normalized = toFolderKey(folderName);
  return configs.some((cfg) => toFolderKey(cfg.key || cfg.displayName || "") === normalized);
}

