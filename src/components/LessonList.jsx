import { BookOpen, ArrowLeft, Plus, Pencil, Trash2, PanelRightClose, PanelRightOpen } from 'lucide-react'

export default function LessonList({
  profile, selectedStudent, setSelectedStudent,
  lessons, selectedLesson,
  isLessonListOpen, setIsLessonListOpen,
  unreadByLesson, isEditing, isCreating,
  selectLesson, setShowDeleteModal, handleNewLesson,
}) {
  return (
    <div className={`absolute lg:relative z-40 h-full top-0 left-0 lg:left-auto ${isLessonListOpen ? 'translate-x-0 w-[280px] lg:w-[320px]' : '-translate-x-full lg:translate-x-0 w-[280px] lg:w-16'} transition-transform duration-300 ease-in-out border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-card)] shrink-0`}>
      {!isLessonListOpen && window.innerWidth >= 1024 ? (
        <div className="flex-1 flex flex-col items-center pt-8">
          <button onClick={() => setIsLessonListOpen(true)} className="text-[var(--text-lighter)] hover:text-[#5A77DF] transition-all mb-8 bg-[var(--bg-input)] p-2 rounded-xl"><PanelRightOpen size={20} /></button>
          <div className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold tracking-[0.2em] text-[var(--text-lighter)] uppercase">Aulas</div>
        </div>
      ) : (
        <div className={`flex flex-col flex-1 h-full ${!isLessonListOpen && window.innerWidth < 1024 ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
          <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between shrink-0 bg-[var(--bg-card)]">
            <div className="overflow-hidden">
              {profile?.role === 'teacher' && (
                <button onClick={() => setSelectedStudent(null)} className="text-[10px] font-bold text-[var(--text-lighter)] hover:text-[#5A77DF] flex items-center gap-1 mb-2 tracking-widest transition-colors">
                  <ArrowLeft size={12} /> DASHBOARD
                </button>
              )}
              <h3 className="text-lg font-bold text-[var(--text-main)] truncate tracking-tight">
                {profile?.role === 'teacher' ? selectedStudent?.full_name : 'My Journal'}
              </h3>
            </div>
            <button onClick={() => setIsLessonListOpen(false)} className="text-[var(--text-lighter)] hover:text-[var(--text-main)] transition-colors ml-2 shrink-0 bg-[var(--bg-input)] p-1.5 rounded-lg"><PanelRightClose size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--bg-app)]/30">
            <div className="flex justify-between items-center mb-6 px-2 mt-2">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Schedule</span>
              {profile?.role === 'teacher' && (
                <button
                  onClick={() => { handleNewLesson(); if (window.innerWidth < 1024) setIsLessonListOpen(false); }}
                  className="flex items-center gap-1 text-[#5A77DF] font-bold text-xs bg-[#5A77DF]/10 hover:bg-[#5A77DF]/20 px-2.5 py-1.5 rounded-lg transition-all border border-[#5A77DF]/20"
                ><Plus size={14} /> Nova</button>
              )}
            </div>

            {lessons.map(l => (
              <div key={l.id} className="group relative">
                <div
                  onClick={() => selectLesson(l, 'view')}
                  className={`p-4 rounded-2xl cursor-pointer transition-all relative border ${selectedLesson?.id === l.id && !isEditing && !isCreating ? 'bg-[#5A77DF] text-white shadow-md border-[#5A77DF]' : l.is_makeup ? 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30 text-yellow-700 dark:text-yellow-500' : 'bg-[var(--bg-card)] hover:bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-main)] shadow-sm'}`}
                >
                  {l.is_makeup && <span className="absolute top-0 right-0 bg-yellow-500 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-bl-lg rounded-tr-lg">Reposição</span>}
                  {unreadByLesson[l.id] && selectedLesson?.id !== l.id && <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full"></div>}
                  <p className={`text-sm font-semibold truncate ${profile?.role === 'teacher' ? 'pr-16 lg:pr-6' : ''} ${unreadByLesson[l.id] && selectedLesson?.id !== l.id ? 'pl-2' : ''}`}>{l.title}</p>
                  {l.late_notice && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${l.extra_fee_paid ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {l.extra_fee_paid ? 'Taxa Paga' : 'Taxa Pendente'}
                      </span>
                    </div>
                  )}
                </div>
                {profile?.role === 'teacher' && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 flex gap-1 bg-[var(--bg-card)] shadow-md p-1 rounded-xl border border-[var(--border-color)] transition-all z-10">
                    <button onClick={(e) => { e.stopPropagation(); selectLesson(l, 'edit'); if (window.innerWidth < 1024) setIsLessonListOpen(false); }} className="p-1.5 text-[var(--text-muted)] hover:text-[#5A77DF] hover:bg-[var(--bg-input)] rounded-lg"><Pencil size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setShowDeleteModal(l.id); }} className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
