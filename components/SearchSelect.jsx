'use client';

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export default function SearchSelect({ value, onChange, options, placeholder = '-- ເລືອກ --', onAdd, compact = false }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)
  const dropRef = useRef(null)
  const addInputRef = useRef(null)

  const updatePos = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const dropUp = spaceBelow < 280 && rect.top > 280
      setPos({
        top: dropUp ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        dropUp
      })
    }
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target) && dropRef.current && !dropRef.current.contains(e.target)) {
        setOpen(false)
        setShowAddForm(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open) {
      updatePos()
      if (inputRef.current) inputRef.current.focus()

      const handleScrollResize = () => updatePos()
      window.addEventListener('scroll', handleScrollResize, true)
      window.addEventListener('resize', handleScrollResize)
      return () => {
        window.removeEventListener('scroll', handleScrollResize, true)
        window.removeEventListener('resize', handleScrollResize)
      }
    }
  }, [open, updatePos])

  useEffect(() => {
    if (showAddForm && addInputRef.current) addInputRef.current.focus()
  }, [showAddForm])

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const selected = options.find(o => o.value === value)

  const handleAdd = async () => {
    if (!newName.trim()) return
    if (onAdd) {
      const success = await onAdd(newName.trim())
      if (success !== false) {
        onChange(newName.trim())
        setNewName('')
        setShowAddForm(false)
        setOpen(false)
      }
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); setShowAddForm(false) }}
        className={`w-full bg-white border outline-none text-left flex items-center justify-between transition-all ${
          compact ? 'px-2 py-0 h-6 rounded text-[12px] leading-none' : 'px-3.5 py-2.5 bg-slate-50/50 rounded-xl text-sm'
        } ${
          open ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200'
        }`}
      >
        <span className={selected ? 'text-slate-800 font-medium truncate' : 'text-slate-300'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-slate-400 transition-transform shrink-0 ml-1 ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: pos.dropUp ? undefined : pos.top,
            bottom: pos.dropUp ? (window.innerHeight - pos.top) : undefined,
            left: pos.left,
            width: pos.width,
            zIndex: 99999
          }}
          className="bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="\u{1F50D} ຄົ້ນຫາ..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-400 placeholder:text-slate-300"
            />
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className={`w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors ${!value ? 'text-red-600 bg-red-50 font-semibold' : 'text-slate-400'}`}
            >
              {placeholder}
            </button>
            {filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${
                  value === o.value ? 'text-red-600 bg-red-50 font-semibold' : 'text-slate-700'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {value === o.value && <svg className="shrink-0 ml-2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
              </button>
            ))}
            {filtered.length === 0 && !showAddForm && (
              <div className="px-3 py-4 text-center text-xs text-slate-400">ບໍ່ພົບຂໍ້ມູນ</div>
            )}
          </div>

          {/* Add New */}
          {onAdd && (
            <div className="border-t border-slate-100">
              {!showAddForm ? (
                <button
                  type="button"
                  onClick={() => { setShowAddForm(true); setNewName(search) }}
                  className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 font-semibold"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  ເພີ່ມໃໝ່{search ? `: "${search}"` : ''}
                </button>
              ) : (
                <div className="p-2.5 bg-red-50/50 space-y-2">
                  <input
                    ref={addInputRef}
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } if (e.key === 'Escape') setShowAddForm(false) }}
                    placeholder="ປ້ອນຊື່ໃໝ່..."
                    className="w-full px-3 py-2 border-2 border-red-300 rounded-lg text-sm outline-none focus:border-red-500 bg-white"
                  />
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setShowAddForm(false)}
                      className="flex-1 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors">ຍົກເລີກ</button>
                    <button type="button" onClick={handleAdd}
                      className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors">{'\u2713'} ເພີ່ມ</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}