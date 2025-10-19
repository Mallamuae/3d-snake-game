export {}

declare global {
  interface Window {
    electronAPI?: {
      loadNotes: () => Promise<any>
      saveNotes: (notes: any[]) => Promise<any>
    }
  }
}
