import React, { useEffect, useState } from 'react'

type Note = { id: string; title: string; content: string; updated: number }

declare global {
  interface Window {
    electronAPI?: {
      loadNotes: () => Promise<Note[]>
      saveNotes: (notes: Note[]) => Promise<any>
    }
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    window.electronAPI?.loadNotes().then((data) => {
      setNotes(data || [])
      if (data && data.length) setActiveId(data[0].id)
    })
  }, [])

  useEffect(() => {
    window.electronAPI?.saveNotes(notes)
  }, [notes])

  const addNote = () => {
    const n: Note = { id: uid(), title: 'Untitled', content: '', updated: Date.now() }
    setNotes((s) => [n, ...s])
    setActiveId(n.id)
  }

  const updateNote = (id: string, patch: Partial<Note>) => {
    setNotes((s) => s.map((x) => (x.id === id ? { ...x, ...patch, updated: Date.now() } : x)))
  }

  const filtered = notes.filter((n) => n.title.toLowerCase().includes(query.toLowerCase()) || n.content.toLowerCase().includes(query.toLowerCase()))
  const active = notes.find((n) => n.id === activeId) || filtered[0] || null

  useEffect(() => {
    if (!active && filtered[0]) setActiveId(filtered[0].id)
  }, [query, notes])

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>CraftLike</h1>
          <button onClick={addNote}>New</button>
        </div>
        <input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="notes-list">
          {filtered.map((n) => (
            <div key={n.id} className={`note-item ${n.id === active?.id ? 'active' : ''}`} onClick={() => setActiveId(n.id)}>
              <div className="note-title">{n.title}</div>
              <div className="note-updated">{new Date(n.updated).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="editor">
        {active ? (
          <div className="editor-inner">
            <input className="title-input" value={active.title} onChange={(e) => updateNote(active.id, { title: e.target.value })} />
            <textarea className="content-input" value={active.content} onChange={(e) => updateNote(active.id, { content: e.target.value })} />
          </div>
        ) : (
          <div className="empty">No note selected</div>
        )}
      </div>
    </div>
  )
}
