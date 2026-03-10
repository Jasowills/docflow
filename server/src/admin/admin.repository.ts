import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { SystemConfig, DocumentTypeConfig, FolderConfig } from '@docflow/shared';

const DEFAULT_GLOBAL_PROMPT = `You are a professional technical writer for DocFlow, an AI workflow documentation platform for websites and web applications.
You produce clear, well-structured documentation based on recordings of real product usage.
Your output must be professional, accurate, and suitable for product, QA, support, and operations teams.
Always use the information from the recorded events and speech narration to describe features and workflows.
Do not invent features, settings, UI elements, business rules, or system behavior that are not evidenced in the recording data.
Maintain a helpful, authoritative tone throughout.`;

const DEFAULT_DOC_TYPES: DocumentTypeConfig[] = [
  {
    key: 'user_reference',
    name: 'User Reference Documentation',
    description: 'Comprehensive reference documentation describing features, screens, controls, and workflow states',
    systemPrompt: `Generate comprehensive user reference documentation.
Structure the document with:
- Overview / Introduction
- Prerequisites (if any)
- Feature description with clear sections for each UI area or workflow
- Field/control descriptions where applicable
- Tips and important notes
Use formal technical writing style. Include step references where actions are sequential. Write for websites and web applications rather than ERP systems.`,
    isActive: true,
    sortOrder: 1,
    createdAtUtc: new Date().toISOString(),
  },
  {
    key: 'tutorial',
    name: 'Tutorial Documentation',
    description: 'Step-by-step tutorial guiding users through a specific website or web app workflow',
    systemPrompt: `Generate a step-by-step tutorial document.
Structure the document with:
- Introduction / Goal (what the user will learn)
- Prerequisites
- Numbered step-by-step instructions matching the recorded actions
- Expected outcomes after each major step
- Summary / Next Steps
Use clear, instructional language. Each step should be actionable and precise.
Reference the exact UI elements, buttons, fields, menus, and page states from the recording.`,
    isActive: true,
    sortOrder: 2,
    createdAtUtc: new Date().toISOString(),
  },
  {
    key: 'test_case_suite',
    name: 'Test Case Suite',
    description: 'Structured functional, UI/UX, and UAT test cases derived from a recorded website or web app workflow',
    systemPrompt: `Generate a complete software test case suite from the recorded workflow.
Your output must contain exactly these major sections, in this order:
- Functional Test Cases
- UI/UX Test Cases
- UAT Test Cases

For each section, produce a Markdown table with these columns:
- Test Case ID
- Title
- Objective
- Preconditions
- Steps
- Expected Result
- Priority
- Evidence / Notes

Formatting rules for test steps:
- In the Steps column, every numbered step must be immediately followed by its own Expected Result.
- Use this exact pattern inside the Steps column:
  1. Do the action.
     Expected Result: The immediate result of that step.
  2. Do the next action.
     Expected Result: The immediate result of that step.
- Do not list all steps first and then add one combined expected result afterward.
- The Expected Result column must contain only the overall final outcome for the full test case.`,
    isActive: true,
    sortOrder: 3,
    createdAtUtc: new Date().toISOString(),
  },
  {
    key: 'release_notes',
    name: 'Release Notes',
    description: 'Release notes highlighting new or changed features for a website or web application',
    systemPrompt: `Generate professional release notes.
Structure the document with:
- Release title and version (if provided)
- Summary of changes
- New Features (with descriptions)
- Improvements
- Known Issues / Limitations (if mentioned)
- Impact on existing workflows (if applicable)
Use concise, business-oriented language appropriate for distribution to customers and stakeholders.`,
    isActive: true,
    sortOrder: 4,
    createdAtUtc: new Date().toISOString(),
  },
];

@Injectable()
export class AdminRepository implements OnModuleInit {
  private readonly logger = new Logger(AdminRepository.name);
  private cachedConfig: SystemConfig | null = null;

  async onModuleInit(): Promise<void> {
    this.cachedConfig = this.buildDefaultConfig();
    this.logger.log('System configuration loaded');
  }

  async getConfig(): Promise<SystemConfig> {
    if (!this.cachedConfig) {
      this.cachedConfig = this.buildDefaultConfig();
    }
    return this.cachedConfig;
  }

  async updateGlobalPrompt(prompt: string, userId: string): Promise<SystemConfig> {
    const config = await this.getConfig();
    this.cachedConfig = {
      ...config,
      globalSystemPrompt: prompt,
      lastModifiedAtUtc: new Date().toISOString(),
      lastModifiedBy: userId,
    };
    return this.cachedConfig;
  }

  async upsertDocumentType(docType: DocumentTypeConfig, userId: string): Promise<SystemConfig> {
    const config = await this.getConfig();
    const documentTypes = [...config.documentTypes];
    const idx = documentTypes.findIndex((dt) => dt.key === docType.key);
    if (idx >= 0) {
      documentTypes[idx] = {
        ...docType,
        createdAtUtc: documentTypes[idx].createdAtUtc,
        lastModifiedAtUtc: new Date().toISOString(),
      };
    } else {
      documentTypes.push({
        ...docType,
        createdAtUtc: new Date().toISOString(),
      });
    }
    this.cachedConfig = {
      ...config,
      documentTypes: documentTypes.sort((a, b) => a.sortOrder - b.sortOrder),
      lastModifiedAtUtc: new Date().toISOString(),
      lastModifiedBy: userId,
    };
    return this.cachedConfig;
  }

  async deleteDocumentType(key: string, userId: string): Promise<SystemConfig> {
    const config = await this.getConfig();
    this.cachedConfig = {
      ...config,
      documentTypes: config.documentTypes.filter((dt) => dt.key !== key),
      lastModifiedAtUtc: new Date().toISOString(),
      lastModifiedBy: userId,
    };
    return this.cachedConfig;
  }

  async upsertFolderConfig(folderConfig: FolderConfig, userId: string): Promise<SystemConfig> {
    const config = await this.getConfig();
    const folders = [...config.folderConfigs];
    const idx = folders.findIndex((item) => item.key === folderConfig.key);
    if (idx >= 0) {
      folders[idx] = {
        ...folderConfig,
        createdAtUtc: folders[idx].createdAtUtc,
        lastModifiedAtUtc: new Date().toISOString(),
      };
    } else {
      folders.push({
        ...folderConfig,
        createdAtUtc: new Date().toISOString(),
      });
    }
    this.cachedConfig = {
      ...config,
      folderConfigs: folders.sort((a, b) => a.sortOrder - b.sortOrder),
      lastModifiedAtUtc: new Date().toISOString(),
      lastModifiedBy: userId,
    };
    return this.cachedConfig;
  }

  async deleteFolderConfig(key: string, userId: string): Promise<SystemConfig> {
    const config = await this.getConfig();
    this.cachedConfig = {
      ...config,
      folderConfigs: config.folderConfigs.filter((item) => item.key !== key),
      lastModifiedAtUtc: new Date().toISOString(),
      lastModifiedBy: userId,
    };
    return this.cachedConfig;
  }

  private buildDefaultConfig(): SystemConfig {
    return {
      configType: 'system',
      globalSystemPrompt: DEFAULT_GLOBAL_PROMPT,
      documentTypes: DEFAULT_DOC_TYPES,
      folderConfigs: [],
      lastModifiedAtUtc: new Date().toISOString(),
      lastModifiedBy: 'system',
    };
  }
}
