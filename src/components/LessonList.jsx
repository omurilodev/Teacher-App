import { useState, useMemo } from 'react'
import { BookOpen, ArrowLeft, Plus, Pencil, Trash2, PanelRightClose, PanelRightOpen, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Funções utilitárias para o dropdown de meses
function formatMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1);
  const mName = d.toLocaleDateString('pt-BR', { month: 'long' });
  // Retorna ex: "Maio 2026"
  return mName.charAt(0).toUpperCase() + mName.slice(1) + ' ' + d.getFullYear();
}

function getMonthOptions() {
  const opts = [], now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    opts.push({ value: v, label: formatMonth(v) });
  }
  return opts;
}

export default function LessonList({
  profile, selectedStudent, setSelectedStudent,
  lessons, selectedLesson,
  isLessonListOpen, setIsLessonListOpen,
  unreadByLesson, isEditing, isCreating,
  selectLesson, setShowDeleteModal, handleNewLesson,
}) {
  
  // Estado para controlar o mês/semana filtrado
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [month, setMonth] = useState(curMonth);
  const [weekOffset, setWeekOffset] = useState(0);
  const monthOpts = useMemo(() => getMonthOptions(), []);

  const weekRange = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    const dow = base.getDay();
    const monday = new Date(base);
    monday.setDate(base.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    const pad = n => String(n).padStart(2, '0');
    const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const monLabel = `${monday.getDate()} ${MONTHS_SHORT[monday.getMonth()]}`;
    const satLabel = `${saturday.getDate()} ${MONTHS_SHORT[saturday.getMonth()]} ${saturday.getFullYear()}`;
    return { mondayISO: toISO(monday), saturdayISO: toISO(saturday), label: `${monLabel} — ${satLabel}` };
  }, [weekOffset]);

  // Lógica que filtra as aulas baseada no modo selecionado
  const filteredLessons = useMemo(() => {
    if (viewMode === 'week') {
      return (lessons || []).filter(l =>
        l.class_date && l.class_date >= weekRange.mondayISO && l.class_date <= weekRange.saturdayISO
      );
    }
    return (lessons || []).filter(l => {
      // Usa o reference_month se existir, senão pega do class_date
      const lessonMonth = l.reference_month || (l.class_date ? l.class_date.substring(0, 7) : null);
      return lessonMonth === month;
    });
  }, [lessons, viewMode, month, weekRange]);

  return (
    <div className={`absolute lg:relative z-40 h-full top-0 left-0 lg:left-auto ${isLessonListOpen ? 'translate-x-0 w-[280px] lg:w-[320px]' : '-translate-x-full lg:translate-x-0 w-[280px] lg:w-16'} transition-transform duration-300 ease-in-out border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-card)] shrink-0`}>
      {!isLessonListOpen && window.innerWidth >= 1024 ? (
        <div className="flex-1 flex flex-col items-center pt-8">
          <button onClick={() => setIsLessonListOpen(true)} className="text-[var(--text-lighter)] hover:text-[#5A77DF] transition-all mb-8 bg-[var(--bg-input)] p-2 rounded-xl"><PanelRightOpen size={20} /></button>
          <div className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold tracking-[0.2em] text-[var(--text-lighter)] uppercase">Aulas</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col w-full h-full">
          <div className="p-5 border-b border-[var(--border-color)] flex flex-col gap-4 relative z-20">
            <div className="flex items-center justify-between">
              <button onClick={() => setIsLessonListOpen(false)} className="lg:hidden p-1.5 text-[var(--text-muted)] hover:text-[#5A77DF] bg-[var(--bg-input)] rounded-lg"><PanelRightClose size={18} /></button>
              {profile?.role === 'teacher' && (
                <button onClick={() => setSelectedStudent(null)} className="text-[10px] font-bold text-[var(--text-lighter)] hover:text-[#5A77DF] flex items-center gap-1 uppercase tracking-widest transition-colors">
                  <ArrowLeft size={12} /> Alunos
                </button>
              )}
            </div>
            
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[var(--text-main)] mb-1 truncate">{selectedStudent?.full_name || 'My Journal'}</h2>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-1.5">
                <BookOpen size={12} /> {filteredLessons.length} Aula{filteredLessons.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Seletor de modo: Mês / Semana */}
            <div className="flex rounded-xl overflow-hidden border border-[var(--border-color)] text-[11px] font-bold">
              <button onClick={() => setViewMode('month')} className={`flex-1 py-2 transition-all ${viewMode === 'month' ? 'bg-[#5A77DF] text-white' : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>Mês</button>
              <button onClick={() => setViewMode('week')} className={`flex-1 py-2 transition-all ${viewMode === 'week' ? 'bg-[#5A77DF] text-white' : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>Semana</button>
            </div>

            {viewMode === 'month' ? (
              <div className="relative">
                <select value={month} onChange={e => setMonth(e.target.value)}
                  className="w-full appearance-none bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] text-sm font-semibold px-4 py-2.5 pr-10 rounded-xl outline-none focus:border-[#5A77DF] transition-all shadow-sm cursor-pointer">
                  {monthOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-lighter)] pointer-events-none" />
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[#5A77DF] transition-colors shrink-0"><ChevronLeft size={14} /></button>
                <span className="flex-1 text-center text-[10px] font-semibold text-[var(--text-main)] leading-tight px-0.5">{weekRange.label}</span>
                <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[#5A77DF] transition-colors shrink-0"><ChevronRight size={14} /></button>
                <button onClick={() => setWeekOffset(0)} className="p-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[10px] font-bold text-[var(--text-muted)] hover:text-[#5A77DF] transition-colors shrink-0">Hoje</button>
              </div>
            )}

            {profile?.role === 'teacher' && (
              <button onClick={handleNewLesson} className="w-full bg-[#5A77DF] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#4a63be] shadow-md shadow-[#5A77DF]/20 active:scale-95 transition-all text-sm">
                <Plus size={16} /> Nova Aula
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 relative z-10">
            {filteredLessons.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-[var(--text-lighter)] italic">{viewMode === 'week' ? 'Nenhuma aula nesta semana.' : 'Nenhuma aula neste mês.'}</p>
              </div>
            ) : (
              filteredLessons.map((l) => (
                <div key={l.id} onClick={() => { selectLesson(l); if (window.innerWidth < 1024) setIsLessonListOpen(false); }}
                  className={`group p-4 rounded-2xl cursor-pointer border transition-all relative overflow-hidden ${selectedLesson?.id === l.id && !isEditing && !isCreating ? 'bg-[#5A77DF]/10 border-[#5A77DF]/30 shadow-sm' : 'bg-[var(--bg-input)] border-[var(--border-color)] hover:border-[#5A77DF]/40 hover:shadow-sm'}`}>
                  {selectedLesson?.id === l.id && !isEditing && !isCreating && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#5A77DF]" />}
                  <div className="flex justify-between items-start mb-2 relative z-10">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${selectedLesson?.id === l.id ? 'text-[#5A77DF]' : 'text-[var(--text-lighter)]'}`}>
                      {l.class_date ? new Date(l.class_date + 'T00:00').toLocaleDateString('pt-BR') : 'Sem data'}
                    </span>
                    {unreadByLesson[l.id] && selectedLesson?.id !== l.id && (
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"></div>
                    )}
                  </div>
                  <p className={`font-bold text-sm text-[var(--text-main)] truncate ${profile?.role === 'teacher' ? 'group-hover:pr-6' : ''} ${unreadByLesson[l.id] && selectedLesson?.id !== l.id ? 'pl-2' : ''}`}>{l.title}</p>
                  
                  {/* Badges de status */}
                  {(l.is_absent || l.is_makeup || l.late_notice) && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {l.is_absent && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">Falta</span>
                      )}
                      {l.is_makeup && (
                        l.end_time
                          ? <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">✅ Reposição Feita</span>
                          : <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">Reposição</span>
                      )}
                      {l.is_makeup && l.late_notice && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20">Aviso Tardio</span>
                      )}
                      {l.late_notice && !l.is_absent && profile?.role === 'teacher' && (
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${l.extra_fee_paid ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                          {l.extra_fee_paid ? 'Taxa Paga' : 'Taxa Pendente'}
                        </span>
                      )}
                    </div>
                  )}

                  {profile?.role === 'teacher' && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 flex gap-1 bg-[var(--bg-card)] shadow-md p-1 rounded-xl border border-[var(--border-color)] transition-all z-10">
                      <button onClick={(e) => { e.stopPropagation(); selectLesson(l, 'edit'); if (window.innerWidth < 1024) setIsLessonListOpen(false); }} className="p-1.5 text-[var(--text-muted)] hover:text-[#5A77DF] hover:bg-[var(--bg-input)] rounded-lg"><Pencil size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setShowDeleteModal(l.id); }} className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}