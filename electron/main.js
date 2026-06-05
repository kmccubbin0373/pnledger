import { app, BrowserWindow, shell } from 'electron'
import electronUpdater from 'electron-updater'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { autoUpdater } = electronUpdater

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = process.env.ELECTRON_DEV === '1'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#f6f7f5',
    title: 'P n Ledger',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // Open external links in the system browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })
}

app.whenReady().then(() => {
  if (!isDev) {
    app.setLoginItemSettings({
      openAtLogin: true,
      name: 'P n Ledger',
      path: process.execPath,
    })
  }

  createWindow()

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
