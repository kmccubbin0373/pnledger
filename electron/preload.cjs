// CommonJS preload (.cjs) — the package is ESM ("type":"module"), so the
// preload must be .cjs to use require() in Electron's preload context.
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('pnledger', {
  platform: process.platform,
  isElectron: true,
})
