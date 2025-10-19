# CraftLike (Electron + Vite + React)

Minimal Craft-like note app scaffold for Windows. Produces a Windows installer or portable executable via electron-builder.

Getting started (Windows PowerShell):

1. Install dependencies

```powershell
cd craft-like-app; npm install
```

2. Run in development (starts Vite + Electron)

```powershell
npm run dev
```

3. Build renderer and create distributable (.exe)

```powershell
npm run dist
```

Notes and limitations:
- This is a minimal scaffold. You may want to add authentication, syncing, richer block editor, or Markdown support.
- Code signing for Windows installers is not configured.
