import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { X, Save } from 'lucide-react'

export default function LessonForm({
  isEditing,
  editTitle, setEditTitle,
  editContent, setEditContent,
  editClassDate, setEditClassDate,
  editStartTime, setEditStartTime,
  editEndTime, setEditEndTime,
  editIsMakeup, setEditIsMakeup,
  editLateNotice, setEditLateNotice,
  editExtraFeePaid, setEditExtraFeePaid,
  handleSaveLesson, setIsCreating, setIsEditing,
  modules,
}) {
  return (
    <form onSubmit={handleSaveLesson} className="flex-1 flex flex-col p-6 md:p-10 space-y-6 overflow-y-auto animate-in fade-in duration-300 relative z-10 pt-8 lg:pt-10">
      <div className="flex justify-between items-center bg-[var(--bg-input)] p-4 rounded-2xl border border-[var(--border-color)]">
        <span className="text-[10px] font-bold text-[#5A77DF] uppercase tracking-widest px-2 py-1 bg-[#5A77DF]/10 rounded-md">
          {isEditing ? 'Editing Lesson' : 'New Assignment'}
        </span>
        <button type="button" onClick={() => { setIsCreating(false); setIsEditing(false); }} className="text-[var(--text-lighter)] hover:text-red-500 bg-[var(--bg-card)] p-1.5 rounded-lg shadow-sm border border-[var(--border-color)]"><X size={18} /></button>
      </div>

      <input
        value={editTitle}
        onChange={e => setEditTitle(e.target.value)}
        className="bg-transparent text-3xl md:text-4xl font-bold text-[var(--text-main)] outline-none border-b border-[var(--border-color)] pb-4 placeholder:text-[var(--text-lighter)] tracking-tight"
        placeholder="Lesson Title..."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest block mb-1">Data da Aula</label>
          <input type="date" value={editClassDate} onChange={e => setEditClassDate(e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] text-sm rounded-xl px-4 py-3 outline-none focus:border-[#5A77DF]" required />
        </div>
        <div>
          <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest block mb-1">Início (Check-in)</label>
          <input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] text-sm rounded-xl px-4 py-3 outline-none focus:border-[#5A77DF]" required />
        </div>
        <div>
          <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest block mb-1">Fim (Check-out)</label>
          <input type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] text-sm rounded-xl px-4 py-3 outline-none focus:border-[#5A77DF]" />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 p-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl">
        <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)] cursor-pointer">
          <input type="checkbox" checked={editIsMakeup} onChange={e => setEditIsMakeup(e.target.checked)} className="w-4 h-4 accent-[#5A77DF]" />
          Aula de Reposição
        </label>
        <label className="flex items-center gap-2 text-sm font-bold text-orange-500 cursor-pointer">
          <input
            type="checkbox"
            checked={editLateNotice}
            onChange={e => { setEditLateNotice(e.target.checked); if (!e.target.checked) setEditExtraFeePaid(false); }}
            className="w-4 h-4 accent-orange-500"
          />
          Aviso Tardio (Cobrar à parte)
        </label>
        {editLateNotice && (
          <label className="flex items-center gap-2 text-sm font-bold text-emerald-500 cursor-pointer md:ml-auto md:border-l md:border-[var(--border-color)] md:pl-4">
            <input type="checkbox" checked={editExtraFeePaid} onChange={e => setEditExtraFeePaid(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
            Taxa Extra Paga
          </label>
        )}
      </div>

      <div className="flex-1 bg-[var(--bg-card)] rounded-[2rem] border border-[var(--border-color)] overflow-hidden shadow-sm flex flex-col min-h-[300px]">
        <ReactQuill theme="snow" value={editContent} onChange={setEditContent} modules={modules} className="h-full flex-1 flex flex-col editor-clean" />
      </div>

      <div className="flex justify-end pt-2 pb-6 md:pb-0">
        <button type="submit" className="w-full md:w-auto bg-[#5A77DF] text-white font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#4a63be] transition-all shadow-lg active:scale-95 text-sm">
          <Save size={18} /> {isEditing ? 'Update Lesson' : 'Publish to Journal'}
        </button>
      </div>
    </form>
  )
}
