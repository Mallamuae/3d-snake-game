import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  loadNotes: () => ipcRenderer.invoke('notes:load'),
  saveNotes: (notes: any) => ipcRenderer.invoke('notes:save', notes)
})
