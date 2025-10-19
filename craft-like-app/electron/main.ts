import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Simple notes persistence using JSON file in app data
const notesPath = join(app.getPath('userData'), 'notes.json')

ipcMain.handle('notes:load', async () => {
  try {
    if (!existsSync(notesPath)) return []
    const data = readFileSync(notesPath, 'utf-8')
    return JSON.parse(data)
  } catch (e) {
    return []
  }
})

ipcMain.handle('notes:save', async (_event, notes) => {
  try {
    writeFileSync(notesPath, JSON.stringify(notes, null, 2), 'utf-8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})
