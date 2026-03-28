import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Megaphone, Check, X } from 'lucide-react'
import { Card } from '../ui/Card'
import { useDisplayStore, Announcement } from '../../store/displayStore'

const PRIORITY_COLORS = {
  normal:    '#0078d4',
  important: '#f7630c',
  urgent:    '#e74856',
}

const PRIORITY_LABELS: Announcement['priority'][] = ['normal', 'important', 'urgent']

function AnnouncementRow({ a }: { a: Announcement }) {
  const { updateAnnouncement, removeAnnouncement } = useDisplayStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(a.text)
  const [priority, setPriority] = useState<Announcement['priority']>(a.priority)

  const commit = () => {
    if (draft.trim()) {
      updateAnnouncement(a.id, { text: draft.trim(), priority })
    }
    setEditing(false)
  }

  const cancel = () => {
    setDraft(a.text)
    setPriority(a.priority)
    setEditing(false)
  }

  if (editing) {
    return (
      <motion.div
        layout
        className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-2 space-y-2"
      >
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) commit(); if (e.key === 'Escape') cancel() }}
          rows={2}
          className="w-full text-xs px-2 py-1.5 rounded-md bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
        />
        {/* Priority picker */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--text-tertiary)]">Priority:</span>
          {PRIORITY_LABELS.map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors capitalize"
              style={
                priority === p
                  ? { background: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p], color: '#fff' }
                  : { background: `${PRIORITY_COLORS[p]}15`, borderColor: `${PRIORITY_COLORS[p]}30`, color: PRIORITY_COLORS[p] }
              }
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-1.5">
          <button onClick={cancel} className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] transition-colors">
            <X size={10} /> Cancel
          </button>
          <button onClick={commit} disabled={!draft.trim()} className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-[var(--accent)] text-white disabled:opacity-40 transition-colors">
            <Check size={10} /> Save
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className="flex items-start gap-2 p-2 rounded-lg hover:bg-[var(--reveal-bg)] group transition-colors cursor-pointer"
      onClick={() => setEditing(true)}
    >
      <div
        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
        style={{ background: PRIORITY_COLORS[a.priority] }}
      />
      <p className="flex-1 text-xs text-[var(--text)] leading-relaxed">{a.text}</p>
      <button
        onClick={(e) => { e.stopPropagation(); removeAnnouncement(a.id) }}
        className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
      >
        <Trash2 size={11} />
      </button>
    </motion.div>
  )
}

export function AnnouncementWidget() {
  const { announcements, addAnnouncement } = useDisplayStore()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [newPriority, setNewPriority] = useState<Announcement['priority']>('normal')

  const submit = () => {
    if (draft.trim()) {
      addAnnouncement(draft.trim(), newPriority)
      setDraft('')
      setNewPriority('normal')
      setAdding(false)
    }
  }

  return (
    <Card className="h-full flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone size={14} className="text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--text)]">Announcements</h3>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--accent)] transition-colors"
          title="Add announcement"
        >
          <Plus size={14} />
        </button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 p-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false) }}
                placeholder="New announcement…"
                className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {PRIORITY_LABELS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setNewPriority(p)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors capitalize"
                      style={
                        newPriority === p
                          ? { background: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p], color: '#fff' }
                          : { background: `${PRIORITY_COLORS[p]}15`, borderColor: `${PRIORITY_COLORS[p]}30`, color: PRIORITY_COLORS[p] }
                      }
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setAdding(false)} className="px-2 py-1 text-[10px] rounded-md text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)]">Cancel</button>
                  <button onClick={submit} disabled={!draft.trim()} className="px-2.5 py-1 text-[10px] bg-[var(--accent)] text-white rounded-md disabled:opacity-40 hover:bg-[var(--accent-hover)]">Add</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar">
        {announcements.length === 0 && (
          <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No announcements — click + to add</p>
        )}
        <AnimatePresence>
          {announcements.map((a) => (
            <AnnouncementRow key={a.id} a={a} />
          ))}
        </AnimatePresence>
      </div>

      <p className="text-[10px] text-[var(--text-tertiary)] text-center">Click any announcement to edit</p>
    </Card>
  )
}
