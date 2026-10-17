import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { is, optimizer } from '@electron-toolkit/utils'
import { registerIpc } from './ipc'
import type { TaskManager } from './tasks'

app.setName('REA Desktop')
let tasks: TaskManager | undefined
let quitting = false

function createWindow(): void {
  const window = new BrowserWindow({
    title: 'REA Desktop',
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    show: false,
    backgroundColor: '#101113',
    autoHideMenuBar: true,
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault()
  })
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  app.setAppUserModelId('tools.rea.desktop')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  tasks = registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  quitting = true
  void (tasks?.close() ?? Promise.resolve()).catch(console.error).finally(() => app.quit())
})
