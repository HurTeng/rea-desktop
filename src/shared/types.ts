import type { TargetFormat, TargetFamily } from './formats'
import type { Language } from './locale'

export type JsonObject = Record<string, unknown>
export type TaskStatus = 'analyzing' | 'answering' | 'completed' | 'cancelled' | 'error'

export interface Target {
  path: string
  inputPath: string
  companionPath?: string
  name: string
  format: TargetFormat
  family?: TargetFamily
  managed?: boolean
  appleBundle?: boolean
  packaging?: { kind: 'pyinstaller'; pythonVersion: number }
  bytes?: number
  web?: { cdpEndpoint: string; targetId: string }
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'notice'
  content: string
  createdAt: string
  incomplete?: boolean
}

export interface EvidenceReference {
  id: string
  operation: string
  title: string
  createdAt: string
}

export interface AnalysisScope {
  mode: 'architecture'
  sourcePath: string
  totalFiles: number
  selectedFiles: number
  missingUnpackedCount: number
  limitations: string[]
  [key: string]: unknown
}

export interface RecoveredFile {
  path: string
  bytes: number
  representation: string
}
export interface RecoveryResult {
  directory: string
  files: RecoveredFile[]
  limitations: string[]
  createdAt: string
}
export interface EngineSettings {
  command?: string
  arguments?: string[]
  provider: string
  environment: Record<string, string>
}
export interface EngineTool {
  name: string
  description: string
  inputSchema: JsonObject
  available: boolean
  reason: string
  remediation: string | null
  effects: string[]
}
export interface EngineStatus {
  entrypoint?: string
  buildType?: 'source' | 'release' | 'custom'
  version: string
  tools: EngineTool[]
  providers: JsonObject[]
  runtime: string
  warning?: string
  availabilityPending?: boolean
}

export interface Task {
  engine?: 'source' | 'release'
  targetFacts?: JsonObject
  analysisFamily?: TargetFamily
  analysisIssues?: string[]
  recovery?: RecoveryResult
  language?: Language
  analysisMode?: 'architecture' | 'full'
  analysisScope?: AnalysisScope
  id: string
  target: Target
  title: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
  messages: Message[]
  summary: JsonObject | null
  parentEvidenceId: string | null
  evidence: EvidenceReference[]
  bundleSaved: boolean
  error: string | null
}

export interface TaskOverview {
  id: string
  title: string
  targetName: string
  status: TaskStatus
  updatedAt: string
}

export type ModelProtocol = 'chat-completions' | 'responses' | 'anthropic'

export interface ModelProfile {
  id: string
  name: string
  protocol: ModelProtocol
  baseUrl: string
  model: string
  hasApiKey: boolean
  source?: string
}

export interface ModelSettings extends ModelProfile {
  profiles: ModelProfile[]
}

export interface CCSwitchCandidate extends ModelProfile {
  current: boolean
  available: boolean
  reason?: string
}

export interface SettingsInput {
  id?: string
  name?: string
  protocol?: ModelProtocol
  baseUrl: string
  model: string
  apiKey?: string
  clearApiKey?: boolean
}

export interface Progress {
  taskId: string
  label: string
}

export interface ModulePage {
  items: JsonObject[]
  nextOffset: number | null
  total: number
  evidenceId: string
  limitations: string[]
}

export interface EvidencePreview {
  id: string
  text: string
  truncated: boolean
}

export interface AppearancePreferences {
  theme: 'light' | 'dark'
  language: Language
}

export interface ToolRunOverview {
  id: string
  tool: string
  createdAt: string
  taskId: string | null
}
export interface DesktopApi {
  saveToolArtifact: (input: {
    dataBase64: string
    mediaType: string
    name?: string
  }) => Promise<string | null>
  revealPath: (path: string) => Promise<void>
  previewImage: (path: string) => Promise<string>
  listToolRuns: () => Promise<ToolRunOverview[]>
  readToolRun: (id: string) => Promise<JsonObject>
  pickPath: (kind: 'file' | 'directory' | 'save') => Promise<string | null>
  saveToolResult: (value: JsonObject) => Promise<string | null>
  getEngineSettings: () => Promise<EngineSettings>
  saveEngineSettings: (input: EngineSettings) => Promise<void>
  getEngineStatus: (taskId?: string) => Promise<EngineStatus>
  getEngineCatalog: (taskId?: string) => Promise<EngineStatus>
  cancelEngineStatus: () => Promise<void>
  runReaTool: (input: {
    taskId?: string
    name: string
    args: JsonObject
    allowEffects?: boolean
  }) => Promise<JsonObject>
  recoverCode: (taskId: string, procedure?: string) => Promise<RecoveryResult>
  readRecoveredFile: (taskId: string, path: string) => Promise<EvidencePreview>
  exportRecoveredCode: (taskId: string) => Promise<string | null>
  revealRecovery: (taskId: string) => Promise<void>
  getPreferences: () => Promise<AppearancePreferences | null>
  savePreferences: (preferences: AppearancePreferences) => Promise<void>
  pickTarget: (kind: 'file' | 'directory', language?: Language) => Promise<Target | null>
  resolveTarget: (path: string) => Promise<Target>
  pathForFile: (file: File) => string
  listTasks: () => Promise<TaskOverview[]>
  getTask: (id: string) => Promise<Task>
  runTask: (input: {
    taskId?: string
    target?: Target
    question: string
    analysisMode?: 'architecture' | 'full'
    language?: Language
  }) => Promise<Task>
  cancelTask: () => Promise<void>
  deleteTask: (id: string) => Promise<void>
  clearTasks: () => Promise<number>
  listModules: (taskId: string, offset: number) => Promise<ModulePage>
  getEvidence: (taskId: string, id: string) => Promise<EvidencePreview>
  exportTask: (
    taskId: string,
    format: 'markdown' | 'json',
    language?: Language
  ) => Promise<string | null>
  getSettings: () => Promise<ModelSettings>
  saveSettings: (input: SettingsInput) => Promise<ModelSettings>
  activateModel: (id: string) => Promise<ModelSettings>
  deleteModel: (id: string) => Promise<ModelSettings>
  listCCSwitch: () => Promise<CCSwitchCandidate[]>
  importCCSwitch: (id: string) => Promise<ModelSettings>
  checkEngine: () => Promise<string>
  checkModel: (input: SettingsInput) => Promise<string>
  openExternal: (url: string) => Promise<void>
  onTaskUpdate: (callback: (task: Task) => void) => () => void
  onProgress: (callback: (progress: Progress | null) => void) => () => void
}
