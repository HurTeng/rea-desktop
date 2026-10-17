import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { DesktopApi, Progress, Task } from '../shared/types'

const api: DesktopApi = {
  saveToolArtifact: (input) => ipcRenderer.invoke('rea:save-tool-artifact', input),
  revealPath: (path) => ipcRenderer.invoke('rea:reveal-path', path),
  previewImage: (path) => ipcRenderer.invoke('rea:preview-image', path),
  listToolRuns: () => ipcRenderer.invoke('rea:list-tool-runs'),
  readToolRun: (id) => ipcRenderer.invoke('rea:read-tool-run', id),
  pickPath: (kind) => ipcRenderer.invoke('rea:pick-path', kind),
  saveToolResult: (value) => ipcRenderer.invoke('rea:save-tool-result', value),
  getEngineSettings: () => ipcRenderer.invoke('rea:get-engine-settings'),
  saveEngineSettings: (value) => ipcRenderer.invoke('rea:save-engine-settings', value),
  getEngineStatus: (id) => ipcRenderer.invoke('rea:get-engine-status', id),
  getEngineCatalog: (id) => ipcRenderer.invoke('rea:get-engine-catalog', id),
  cancelEngineStatus: () => ipcRenderer.invoke('rea:cancel-engine-status'),
  runReaTool: (input) => ipcRenderer.invoke('rea:run-tool', input),
  recoverCode: (id, procedure) => ipcRenderer.invoke('rea:recover-code', id, procedure),
  readRecoveredFile: (id, path) => ipcRenderer.invoke('rea:read-recovered', id, path),
  exportRecoveredCode: (id) => ipcRenderer.invoke('rea:export-recovered', id),
  revealRecovery: (id) => ipcRenderer.invoke('rea:reveal-recovery', id),
  getPreferences: () => ipcRenderer.invoke('rea:get-preferences'),
  savePreferences: (value) => ipcRenderer.invoke('rea:save-preferences', value),
  pickTarget: (kind, language) => ipcRenderer.invoke('rea:pick-target', kind, language),
  resolveTarget: (path) => ipcRenderer.invoke('rea:resolve-target', path),
  pathForFile: (file) => webUtils.getPathForFile(file),
  listTasks: () => ipcRenderer.invoke('rea:list-tasks'),
  getTask: (id) => ipcRenderer.invoke('rea:get-task', id),
  runTask: (input) => ipcRenderer.invoke('rea:run-task', input),
  cancelTask: () => ipcRenderer.invoke('rea:cancel-task'),
  deleteTask: (id) => ipcRenderer.invoke('rea:delete-task', id),
  clearTasks: () => ipcRenderer.invoke('rea:clear-tasks'),
  listModules: (id, offset) => ipcRenderer.invoke('rea:list-modules', id, offset),
  getEvidence: (taskId, id) => ipcRenderer.invoke('rea:get-evidence', taskId, id),
  exportTask: (id, format, language) => ipcRenderer.invoke('rea:export-task', id, format, language),
  getSettings: () => ipcRenderer.invoke('rea:get-settings'),
  saveSettings: (input) => ipcRenderer.invoke('rea:save-settings', input),
  activateModel: (id) => ipcRenderer.invoke('rea:activate-model', id),
  deleteModel: (id) => ipcRenderer.invoke('rea:delete-model', id),
  listCCSwitch: () => ipcRenderer.invoke('rea:list-cc-switch'),
  importCCSwitch: (id) => ipcRenderer.invoke('rea:import-cc-switch', id),
  checkEngine: () => ipcRenderer.invoke('rea:check-engine'),
  checkModel: (input) => ipcRenderer.invoke('rea:check-model', input),
  openExternal: (url) => ipcRenderer.invoke('rea:open-external', url),
  onTaskUpdate: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, task: Task): void => callback(task)
    ipcRenderer.on('rea:task-updated', listener)
    return () => {
      ipcRenderer.removeListener('rea:task-updated', listener)
    }
  },
  onProgress: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, progress: Progress | null): void =>
      callback(progress)
    ipcRenderer.on('rea:progress', listener)
    return () => {
      ipcRenderer.removeListener('rea:progress', listener)
    }
  }
}
contextBridge.exposeInMainWorld('rea', api)
