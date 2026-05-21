import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import { useLessonsRealtime } from '../hooks/useLessonsRealtime';
import {
  ArrowLeft, Clock, DollarSign, CalendarCheck, CalendarX2, UserCheck,
  Loader2, CheckCircle2, AlertCircle, Plus, ChevronDown, X, Save,
  AlertTriangle, RefreshCw, Package, CreditCard, History, CalendarClock, ArrowRight, FileText,
  BookOpen, Wallet, CalendarDays, Trash2, Receipt, Pencil, Check,
} from 'lucide-react';
import PaymentReceipts from './PaymentReceipts';
import { showConfirm, showAlert } from './AlertModal';
import { generateAllScheduleLessons } from '../utils/generateLessons';

function formatMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function formatMonthPT(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1);
  const name = d.toLocaleDateString('pt-BR', { month: 'long' });
  return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + d.getFullYear();
}
function formatTime(t) {
  if (!t) return '—';
  // t is a plain TIME string like '14:30:00' — parse manually
  const parts = t.split(':');
  if (parts.length >= 2) {
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }
  return t;
}
/** Extracts 'HH:mm' or 'HH:mm:ss' from any input, stripping date prefix if present */
function toTime(val) {
  if (!val) return null;
  // If it contains 'T' (e.g. '2026-05-18T14:30'), take only the time part
  if (val.includes('T')) return val.split('T')[1];
  return val; // already 'HH:mm' or 'HH:mm:ss'
}
function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return d; }
}

function getMonthOptions() {
  const opts = [], now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    opts.push({ value: v, label: formatMonthPT(v) });
  }
  return opts;
}

export default function StudentDetail({ student, profile, onBack }) {
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [filterMonth, setFilterMonth] = useState('all'); // 'all' | 'YYYY-MM'
  const [updating, setUpdating] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const monthOpts = useMemo(() => getMonthOptions(), []);

  // New lesson form
  const [form, setForm] = useState({ title: '', start_time: '', end_time: '', duration_minutes: 60, is_absent: false, makeup_class_date: '', notes: '' });
  const [activeTab, setActiveTab] = useState('aulas'); // 'aulas' | 'pagamentos' | 'reagendamentos'

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Single hook fetches ALL lessons; filtering is done client-side
  const { lessons: allLessons, setLessons, loading, error } = useLessonsRealtime({ studentId: student.id });

  const sorted = useMemo(() => {
    const base = filterMonth === 'all'
      ? (allLessons || [])
      : (allLessons || []).filter(l => {
          const lm = l.reference_month || (l.class_date ? l.class_date.substring(0, 7) : null);
          return lm === filterMonth;
        });
    return [...base].sort((a, b) => {
      const dateA = a.class_date || '';
      const dateB = b.class_date || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA); // newest first
      return (b.start_time || '').localeCompare(a.start_time || '');
    });
  }, [allLessons, filterMonth]);

  const groupedSorted = useMemo(() => {
    const items = [];
    let lastMonth = null;
    let lessonNum = 0;
    for (const l of sorted) {
      const lm = l.reference_month || (l.class_date ? l.class_date.substring(0, 7) : null);
      if (lm !== lastMonth) {
        items.push({ type: 'separator', month: lm });
        lastMonth = lm;
      }
      lessonNum++;
      items.push({ type: 'lesson', lesson: l, num: lessonNum });
    }
    return items;
  }, [sorted]);

  const totalMin = sorted.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const totalH = (totalMin / 60).toFixed(1);
  const presences = sorted.filter(l => !l.is_absent).length;
  const absences = sorted.filter(l => l.is_absent).length;

  // --- Profile-based payment cycle ---
  const [lastPayDate, setLastPayDate] = useState(student.last_payment_date || null);
  const [payDate, setPayDate] = useState('');
  const [savingPay, setSavingPay] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [editingPayDate, setEditingPayDate] = useState(false);
  const [editPayDateValue, setEditPayDateValue] = useState('');
  const [savingPayDate, setSavingPayDate] = useState(false);

  // Keep in sync if student prop changes
  useEffect(() => { setLastPayDate(student.last_payment_date || null); }, [student.last_payment_date]);

  const confirmPayDateEdit = async () => {
    if (!editPayDateValue) return;
    setSavingPayDate(true);
    try {
      const { error } = await supabase.from('profiles').update({ last_payment_date: editPayDateValue }).eq('id', student.id);
      if (error) throw error;
      setLastPayDate(editPayDateValue);
      setEditingPayDate(false);
      const hadSchedules = await generateAllScheduleLessons(student.id, editPayDateValue);
      if (hadSchedules) {
        showAlert('Sucesso', 'Pagamento registrado e aulas criadas!', 'success');
      } else {
        showAlert('Sucesso', 'Data de pagamento atualizada! Cadastre um horário fixo para criar as aulas automaticamente.', 'info');
      }
    } catch (e) {
      console.error(e);
      showAlert('Erro', 'Falha ao atualizar a data de pagamento.', 'error');
    } finally {
      setSavingPayDate(false);
    }
  };

  const registerPayment = async () => {
    if (!payDate) return;
    setSavingPay(true);
    try {
      const { error } = await supabase.from('profiles').update({ last_payment_date: payDate }).eq('id', student.id);
      if (error) throw error;

      await supabase.from('payment_history').insert({ student_id: student.id, payment_date: payDate });

      setLastPayDate(payDate);
      setPayDate('');
      setShowPayForm(false);

      fetchExtras();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('student-updated'));
      }

      const hadSchedules = await generateAllScheduleLessons(student.id, payDate);
      if (hadSchedules) {
        showAlert('Sucesso', 'Pagamento registrado e aulas criadas!', 'success');
      } else {
        showAlert('Sucesso', 'Data de pagamento atualizada! Cadastre um horário fixo para criar as aulas automaticamente.', 'info');
      }
    } catch (e) {
      console.error('Error updating payment date:', e);
      showAlert('Erro', 'Falha ao registrar o pagamento.', 'error');
    }
    finally { setSavingPay(false); }
  };

  // All lessons sorted by class_date for cycle
  const allSortedByDate = useMemo(() => {
    return [...(allLessons || [])].sort((a, b) => {
      const da = a.class_date || a.created_at || '';
      const db = b.class_date || b.created_at || '';
      return da.localeCompare(db);
    });
  }, [allLessons]);

  // Count realized lessons (end_time set) with class_date >= last_payment_date
  const cycleInfo = useMemo(() => {
    if (!lastPayDate) {
      return { consumedClasses: 0, hasPayment: false, remaining: 0 };
    }
    const realized = allSortedByDate.filter(l =>
      l.class_date && l.class_date >= lastPayDate && (
        (!l.is_makeup && !l.is_absent && l.end_time) ||
        (l.is_absent && l.late_notice) ||
        (l.is_makeup && !l.late_notice && l.end_time)
      )
    );
    const consumed = realized.length;
    return { consumedClasses: consumed, hasPayment: true, remaining: Math.max(0, 4 - consumed) };
  }, [allSortedByDate, lastPayDate]);

  // Build Set of lesson IDs that are "Pago" (first 4 realized after last_payment_date)
  const paidLessonIds = useMemo(() => {
    const ids = new Set();
    if (!lastPayDate) return ids;
    const realized = allSortedByDate.filter(l =>
      l.class_date && l.class_date >= lastPayDate && (
        (!l.is_makeup && !l.is_absent && l.end_time) ||
        (l.is_absent && l.late_notice) ||
        (l.is_makeup && !l.late_notice && l.end_time)
      )
    );
    for (let i = 0; i < Math.min(4, realized.length); i++) {
      ids.add(realized[i].id);
    }
    return ids;
  }, [allSortedByDate, lastPayDate]);

  // --- Extras: Payment History & Rescheduled Lessons ---
  const [payHistory, setPayHistory] = useState([]);
  const [rescheduled, setRescheduled] = useState([]);
  const [loadingExtras, setLoadingExtras] = useState(true);

  const fetchExtras = useCallback(async () => {
    setLoadingExtras(true);
    const [pRes, rRes] = await Promise.all([
      supabase.from('payment_history').select('*').eq('student_id', student.id).order('payment_date', { ascending: false }),
      supabase.from('rescheduled_lessons').select('*').eq('student_id', student.id).order('original_date', { ascending: false })
    ]);
    if (pRes.data) setPayHistory(pRes.data);
    if (rRes.data) setRescheduled(rRes.data);
    setLoadingExtras(false);
  }, [student.id]);

  useEffect(() => {
    fetchExtras();
  }, [fetchExtras]);

  // Reagendar Aula State
  const [resForm, setResForm] = useState({ 
    title: '', 
    new_date: '', 
    new_start_time: '', 
    new_end_time: '', 
    reason: '', 
    is_late: false 
  });
  const [savingRes, setSavingRes] = useState(false);

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!resForm.new_date || !resForm.new_start_time) return;
    
    setSavingRes(true);

    try {
      const { data: newLesson, error: lessonError } = await supabase.from('lessons').insert({
        student_id: student.id,
        reference_month: resForm.new_date ? resForm.new_date.substring(0, 7) : curMonth,
        title: resForm.title || 'Aula Reagendada',
        class_date: resForm.new_date,
        start_time: toTime(resForm.new_start_time),
        end_time: resForm.new_end_time ? toTime(resForm.new_end_time) : null,
        duration_minutes: 60,
        is_absent: resForm.is_late,
        is_late_cancellation: resForm.is_late
      }).select().single();

      if (lessonError) throw lessonError;
      setLessons(prev => [newLesson, ...prev]);

      await supabase.from('rescheduled_lessons').insert({
        student_id: student.id,
        original_date: resForm.new_date,
        new_date: resForm.new_date,
        reason: resForm.reason || null,
        is_late: resForm.is_late
      });

      setResForm({ title: '', new_date: '', new_start_time: '', new_end_time: '', reason: '', is_late: false });
      fetchExtras();
    } catch (err) {
      console.error(err);
      alert('Failed to save rescheduled lesson.');
    } finally {
      setSavingRes(false);
    }
  };

  const update = useCallback(async (id, data) => {
    setUpdating(`${Object.keys(data)[0]}_${id}`);
    try {
      await supabase.from('lessons').update(data).eq('id', id);
      setLessons(prev => prev.map(l => l.id === id ? { ...l, ...data } : l));
    } catch (e) { console.error(e); }
    finally { setUpdating(null); }
  }, [setLessons]);

  const toggleAbsent = (id, cur) => update(id, { is_absent: !cur, ...(cur ? { makeup_class_date: null } : {}) });
  const toggleCheckin = (id, field, cur) => update(id, { [field]: !cur });

  const addLesson = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data, error: insertError } = await supabase.from('lessons').insert({
        student_id: student.id, reference_month: filterMonth !== 'all' ? filterMonth : curMonth,
        title: form.title || `Lesson ${sorted.length + 1}`,
        start_time: toTime(form.start_time), end_time: toTime(form.end_time),
        duration_minutes: Number(form.duration_minutes) || 60,
        is_absent: form.is_absent, makeup_class_date: form.makeup_class_date || null,
        payment_status: 'pending', professor_checkin: false, student_checkin: false,
      }).select().single();
      if (insertError) throw insertError;
      setLessons(prev => [data, ...prev]);
      setForm({ title: '', start_time: '', end_time: '', duration_minutes: 60, is_absent: false, makeup_class_date: '', notes: '' });
      setShowForm(false);
    } catch (err) { console.error(err); alert('Error adding lesson.'); }
    finally { setSaving(false); }
  };

  const deleteLesson = (id) => {
    showConfirm(
      'Excluir Aula',
      'Tem certeza que deseja excluir esta aula? Esta ação não pode ser desfeita.',
      async () => {
        try {
          await supabase.from('lessons').delete().eq('id', id);
          setLessons(prev => prev.filter(l => l.id !== id));
        } catch (e) {
          console.error(e);
        }
      }
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 lg:p-12 animate-in fade-in duration-500">
      <div className="max-w-6xl mx-auto w-full pt-16 lg:pt-0">

        {/* Back + Student Header */}
        {onBack && (
          <button onClick={onBack} className="text-[10px] font-bold text-[var(--text-lighter)] hover:text-[#5A77DF] flex items-center gap-1 mb-6 tracking-widest transition-colors uppercase">
            <ArrowLeft size={12} /> VOLTAR PARA ALUNOS
          </button>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#5A77DF] text-white rounded-2xl flex items-center justify-center text-xl font-bold shadow-lg shadow-[#5A77DF]/20">
              {student.full_name?.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-main)]">{student.full_name}</h1>
              <p className="text-[var(--text-muted)] text-sm">{filterMonth === 'all' ? 'Todos os meses' : formatMonthPT(filterMonth)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                className="appearance-none bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] text-sm font-semibold px-5 py-3 pr-10 rounded-2xl outline-none focus:border-[#5A77DF] transition-all shadow-sm cursor-pointer">
                <option value="all">Todos os meses</option>
                {monthOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-lighter)] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-6 mb-8 border-b border-[var(--border-color)] overflow-x-auto custom-scrollbar">
          <button onClick={() => setActiveTab('aulas')} className={`pb-3 px-1 text-sm font-bold tracking-tight whitespace-nowrap transition-all border-b-2 flex items-center gap-2 ${activeTab === 'aulas' ? 'border-[#5A77DF] text-[#5A77DF]' : 'border-transparent text-[var(--text-lighter)] hover:text-[var(--text-main)]'}`}>
            <BookOpen size={16} /> Aulas
          </button>
          <button onClick={() => setActiveTab('pagamentos')} className={`pb-3 px-1 text-sm font-bold tracking-tight whitespace-nowrap transition-all border-b-2 flex items-center gap-2 ${activeTab === 'pagamentos' ? 'border-[#5A77DF] text-[#5A77DF]' : 'border-transparent text-[var(--text-lighter)] hover:text-[var(--text-main)]'}`}>
            <Wallet size={16} /> Pagamentos
          </button>
          <button onClick={() => setActiveTab('reagendamentos')} className={`pb-3 px-1 text-sm font-bold tracking-tight whitespace-nowrap transition-all border-b-2 flex items-center gap-2 ${activeTab === 'reagendamentos' ? 'border-[#5A77DF] text-[#5A77DF]' : 'border-transparent text-[var(--text-lighter)] hover:text-[var(--text-main)]'}`}>
            <CalendarDays size={16} /> Reagendamentos
          </button>
          <button onClick={() => setActiveTab('comprovantes')} className={`pb-3 px-1 text-sm font-bold tracking-tight whitespace-nowrap transition-all border-b-2 flex items-center gap-2 ${activeTab === 'comprovantes' ? 'border-[#5A77DF] text-[#5A77DF]' : 'border-transparent text-[var(--text-lighter)] hover:text-[var(--text-main)]'}`}>
            <Receipt size={16} /> Comprovantes
          </button>
        </div>

        {/* --- TAB: AULAS --- */}
        {activeTab === 'aulas' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {/* Hours */}
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-[#5A77DF]/10 text-[#5A77DF] rounded-lg flex items-center justify-center"><Clock size={16} /></div>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Total Hours</span>
                </div>
                <p className="text-3xl font-bold text-[var(--text-main)] tracking-tight">{totalH}<span className="text-base text-[var(--text-lighter)] ml-1">hrs</span></p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{totalMin} minutes · {sorted.length} lesson{sorted.length !== 1 ? 's' : ''}</p>
              </div>
              {/* Payment / Package Status */}
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cycleInfo.remaining === 0 ? 'bg-red-500/10 text-red-400' : cycleInfo.remaining === 1 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}><Package size={16} /></div>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Pacote</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className={`text-3xl font-bold tracking-tight ${cycleInfo.remaining === 0 ? 'text-red-400' : cycleInfo.remaining === 1 ? 'text-amber-400' : 'text-emerald-400'}`}>{cycleInfo.remaining}</p>
                  <span className="text-base text-[var(--text-lighter)]">/4</span>
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  {cycleInfo.hasPayment && <span className="block mb-0.5">{cycleInfo.consumedClasses} realizada{cycleInfo.consumedClasses !== 1 ? 's' : ''}</span>}
                  {editingPayDate && profile?.role === 'teacher' ? (
                    <span className="flex items-center gap-1 mt-1">
                      <input type="date" value={editPayDateValue} onChange={e => setEditPayDateValue(e.target.value)}
                        className="flex-1 min-w-0 px-2 py-0.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] text-xs outline-none focus:border-[#5A77DF] transition-all" />
                      <button onClick={confirmPayDateEdit} disabled={savingPayDate || !editPayDateValue}
                        className="shrink-0 p-0.5 text-[#5A77DF] hover:text-[#4a63be] disabled:opacity-50 transition-colors">
                        {savingPayDate ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      </button>
                      <button onClick={() => setEditingPayDate(false)} className="shrink-0 p-0.5 text-[var(--text-lighter)] hover:text-red-400 transition-colors">
                        <X size={12} />
                      </button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      {cycleInfo.hasPayment
                        ? `Pago em ${new Date(lastPayDate + 'T00:00').toLocaleDateString('pt-BR')}`
                        : 'Sem pagamento registrado'}
                      {profile?.role === 'teacher' && (
                        <button onClick={() => { setEditPayDateValue(lastPayDate || ''); setEditingPayDate(true); }}
                          className="text-[var(--text-lighter)] hover:text-[#5A77DF] transition-colors">
                          <Pencil size={10} />
                        </button>
                      )}
                    </span>
                  )}
                </div>
              </div>
              {/* Attendance */}
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center"><CalendarCheck size={16} /></div>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Attendance</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl font-bold text-emerald-400 tracking-tight">{presences}</p>
                  <span className="text-[var(--text-lighter)] text-sm">/</span>
                  <p className="text-xl font-bold text-red-400 tracking-tight">{absences}</p>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">Presences vs Absences</p>
              </div>
            </div>

            {/* Payment Cycle Alert */}
            {cycleInfo.remaining === 1 && cycleInfo.hasPayment && (
              <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4 mb-6 animate-in fade-in duration-300">
                <div className="w-9 h-9 bg-amber-500/15 text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-400 tracking-tight">4ª Aula: Última aula do pacote.</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">3 aulas realizadas — 1 restante</p>
                </div>
              </div>
            )}
            {(cycleInfo.remaining === 0 || !cycleInfo.hasPayment) && allSortedByDate.length > 0 && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 mb-6 animate-in fade-in duration-300">
                <div className="w-9 h-9 bg-red-500/15 text-red-400 rounded-xl flex items-center justify-center shrink-0">
                  <RefreshCw size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-400 tracking-tight">Renovar: Pacote encerrado.</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{cycleInfo.hasPayment ? '4 aulas concluídas desde o último pagamento' : 'Nenhum pagamento registrado'}</p>
                </div>
              </div>
            )}

            {/* Add Lesson Button / Form */}
            {!showForm ? (
              <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-[#5A77DF] text-white font-bold text-sm px-5 py-3 rounded-2xl hover:bg-[#4a63be] transition-all shadow-lg active:scale-95 mb-6">
                <Plus size={16} /> Add Lesson
              </button>
            ) : (
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 mb-6 shadow-sm animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold text-[#5A77DF] uppercase tracking-widest px-2 py-1 bg-[#5A77DF]/10 rounded-md">New Lesson</span>
                  <button onClick={() => setShowForm(false)} className="text-[var(--text-lighter)] hover:text-red-500 bg-[var(--bg-input)] p-1.5 rounded-lg"><X size={16} /></button>
                </div>
                <form onSubmit={addLesson} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest mb-1 block">Title</label>
                    <input value={form.title} onChange={e => setF('title', e.target.value)} placeholder={`Lesson ${sorted.length + 1}`}
                      className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm outline-none focus:border-[#5A77DF] transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest mb-1 block">Start</label>
                    <input type="time" value={form.start_time} onChange={e => setF('start_time', e.target.value)}
                      className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm outline-none focus:border-[#5A77DF] transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest mb-1 block">End</label>
                    <input type="time" value={form.end_time} onChange={e => setF('end_time', e.target.value)}
                      className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm outline-none focus:border-[#5A77DF] transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest mb-1 block">Duration (min)</label>
                    <input type="number" value={form.duration_minutes} onChange={e => setF('duration_minutes', e.target.value)}
                      className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm outline-none focus:border-[#5A77DF] transition-all" />
                  </div>
                  <div className="flex items-end gap-3 col-span-2 sm:col-span-1">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest mb-1 block">Absent</label>
                      <button type="button" onClick={() => setF('is_absent', !form.is_absent)} className={`w-full h-10 rounded-xl flex items-center justify-center font-bold text-xs border transition-all ${form.is_absent ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-[var(--bg-input)] text-[var(--text-lighter)] border-[var(--border-color)] hover:border-[#5A77DF] hover:text-[#5A77DF]'}`}>
                        {form.is_absent ? 'YES' : 'NO'}
                      </button>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest mb-1 block">Notes (Optional)</label>
                    <input value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Lesson notes..."
                      className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm outline-none focus:border-[#5A77DF] transition-all" />
                  </div>
                  <div className="col-span-2 sm:col-span-4 flex justify-end mt-2">
                    <button type="submit" disabled={saving || !form.start_time || !form.end_time} className="bg-[#5A77DF] text-white font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-[#4a63be] disabled:opacity-50 flex items-center gap-2 transition-all">
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Lesson
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Lessons Section */}
            {!loading && (
              <>
                {sorted.length === 0 ? (
                  <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-sm overflow-hidden mb-6">
                    <div className="px-5 py-16 text-center text-[var(--text-lighter)] text-sm italic">
                    {filterMonth === 'all' ? 'Nenhuma aula cadastrada.' : `Nenhuma aula em ${formatMonthPT(filterMonth)}.`}
                  </div>
                  </div>
                ) : (
                  <>
                    {/* Mobile: Card List */}
                    <div className="md:hidden flex flex-col gap-3 mb-6">
                      {groupedSorted.map((item) => {
                        if (item.type === 'separator') {
                          return (
                            <div key={`sep-${item.month}`} className="px-2 py-1 text-xs font-bold tracking-widest text-[var(--text-lighter)] uppercase">
                              {formatMonthPT(item.month)}
                            </div>
                          );
                        }
                        const l = item.lesson;
                        const isMakeup = l.is_makeup || l.title?.toLowerCase().includes('reposição');
                        return (
                          <div key={l.id} className={`border rounded-2xl p-4 shadow-sm ${
                            l.is_late_cancellation ? 'bg-red-500/5 border-red-500/20' :
                            isMakeup ? 'bg-yellow-500/5 border-yellow-500/20' :
                            !l.is_absent ? 'bg-emerald-500/5 border-emerald-500/20' :
                            'bg-[var(--bg-card)] border-[var(--border-color)]'
                          } ${l.is_absent && !l.is_late_cancellation ? 'opacity-60' : ''}`}>
                            {/* Header row */}
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <span className="text-[10px] font-bold text-[var(--text-lighter)] uppercase">#{item.num}</span>
                                  <span className="text-[10px] text-[var(--text-muted)]">
                                    {l.class_date ? new Date(l.class_date + 'T00:00').toLocaleDateString('pt-BR') : '—'}
                                  </span>
                                </div>
                                <p className="font-bold text-sm text-[var(--text-main)] truncate">{l.title || formatDate(l.start_time)}</p>
                                {(isMakeup || l.is_late_cancellation) && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {isMakeup && (l.end_time
                                      ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase tracking-wider">✅ Reposição Feita</span>
                                      : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 uppercase tracking-wider">Reposição</span>
                                    )}
                                    {l.is_late_cancellation && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20 uppercase tracking-wider">Aviso Tardio</span>}
                                  </div>
                                )}
                              </div>
                              {profile?.role === 'teacher' && (
                                <button onClick={() => deleteLesson(l.id)} className="p-1.5 rounded-lg text-[var(--text-lighter)] hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>

                            {/* Time + duration + payment status */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3">
                              <span className="text-xs text-[var(--text-muted)]">{formatTime(l.start_time)} – {formatTime(l.end_time)}</span>
                              <span className="text-xs font-bold text-[var(--text-main)]">{l.duration_minutes || 0} min</span>
                              {(l.is_late_cancellation || l.late_notice) && isMakeup ? (
                                <button onClick={() => update(l.id, { extra_fee_paid: !l.extra_fee_paid })} disabled={updating === `extra_fee_paid_${l.id}`}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${l.extra_fee_paid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                                  {updating === `extra_fee_paid_${l.id}` ? <Loader2 size={10} className="animate-spin" /> : (l.extra_fee_paid ? <><CheckCircle2 size={10} /> Taxa Paga</> : 'Taxa Pendente')}
                                </button>
                              ) : (!lastPayDate || (l.class_date && l.class_date >= lastPayDate && !paidLessonIds.has(l.id))) && !l.is_absent ? (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">Pendente</span>
                              ) : !l.is_absent ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 size={10} /> Pago
                                </span>
                              ) : null}
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <button onClick={() => toggleAbsent(l.id, l.is_absent)} disabled={updating === `is_absent_${l.id}`}
                                className={`h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold border transition-all active:scale-95 ${l.is_absent ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)]'}`}>
                                {updating === `is_absent_${l.id}` ? <Loader2 size={12} className="animate-spin" /> : l.is_absent ? <CalendarX2 size={13} /> : <CalendarCheck size={13} />}
                                {l.is_absent ? 'Falta' : 'Presente'}
                              </button>
                              <button onClick={() => toggleCheckin(l.id, 'professor_checkin', l.professor_checkin)} disabled={updating === `professor_checkin_${l.id}`}
                                title="Professor checkin"
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${l.professor_checkin ? 'bg-[#5A77DF] text-white shadow-sm shadow-[#5A77DF]/30' : 'bg-[var(--bg-input)] text-[var(--text-lighter)] border border-[var(--border-color)]'}`}>
                                {updating === `professor_checkin_${l.id}` ? <Loader2 size={13} className="animate-spin" /> : l.professor_checkin ? <CheckCircle2 size={13} /> : <UserCheck size={13} />}
                              </button>
                              <button onClick={() => toggleCheckin(l.id, 'student_checkin', l.student_checkin)} disabled={updating === `student_checkin_${l.id}`}
                                title="Student checkin"
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${l.student_checkin ? 'bg-[#5A77DF] text-white shadow-sm shadow-[#5A77DF]/30' : 'bg-[var(--bg-input)] text-[var(--text-lighter)] border border-[var(--border-color)]'}`}>
                                {updating === `student_checkin_${l.id}` ? <Loader2 size={13} className="animate-spin" /> : l.student_checkin ? <CheckCircle2 size={13} /> : <UserCheck size={13} />}
                              </button>
                            </div>

                            {/* Makeup date if absent */}
                            {l.is_absent && (
                              <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                                <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest mb-1 block">Data de Reposição</label>
                                <input type="date" value={l.makeup_class_date || ''} onChange={e => update(l.id, { makeup_class_date: e.target.value || null })}
                                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] text-sm px-3 py-2.5 rounded-xl outline-none focus:border-[#5A77DF] transition-all" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop: Table */}
                    <div className="hidden md:block bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-sm overflow-hidden mb-6">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border-color)]">
                              <th className="px-5 py-3 text-left">#</th>
                              <th className="px-3 py-3 text-left">Date</th>
                              <th className="px-3 py-3 text-left">Lesson</th>
                              <th className="px-3 py-3 text-left">Time</th>
                              <th className="px-3 py-3 text-center">Duration</th>
                              <th className="px-3 py-3 text-center">Status</th>
                              <th className="px-3 py-3 text-center">Absent</th>
                              <th className="px-3 py-3 text-center">Makeup</th>
                              <th className="px-3 py-3 text-center">Prof ✓</th>
                              <th className="px-3 py-3 text-center">Student ✓</th>
                              {profile?.role === 'teacher' && <th className="px-3 py-3 text-center w-10"></th>}
                            </tr>
                          </thead>
                          <tbody>
                            {groupedSorted.map((item) => {
                              if (item.type === 'separator') {
                                return (
                                  <tr key={`sep-${item.month}`}>
                                    <td colSpan={profile?.role === 'teacher' ? 11 : 10}
                                      className="px-5 py-2 text-[10px] font-bold tracking-widest text-[var(--text-lighter)] uppercase bg-[var(--bg-input)] border-b border-[var(--border-color)]">
                                      {formatMonthPT(item.month)}
                                    </td>
                                  </tr>
                                );
                              }
                              const l = item.lesson;
                              const isMakeup = l.is_makeup || l.title?.toLowerCase().includes('reposição');
                              return (
                                <tr key={l.id} className={`border-b last:border-b-0 hover:bg-[var(--bg-input)] transition-colors ${l.is_late_cancellation ? 'bg-red-500/10 border-red-500/30' : isMakeup ? 'bg-yellow-500/10 border-yellow-500/30' : !l.is_absent ? 'bg-emerald-500/10 border-emerald-500/30' : 'border-[var(--border-color)]'} ${l.is_absent && !l.is_late_cancellation ? 'opacity-60' : ''}`}>
                                  <td className="px-5 py-3.5 text-[var(--text-lighter)] font-bold">{item.num}</td>
                                  <td className="px-3 py-3.5 text-[var(--text-main)] whitespace-nowrap">{l.class_date ? new Date(l.class_date + 'T00:00').toLocaleDateString('pt-BR') : '—'}</td>
                                  <td className="px-3 py-3.5 font-semibold text-[var(--text-main)] whitespace-nowrap">
                                    <div className="flex flex-col gap-1">
                                      <span>{l.title || formatDate(l.start_time)}</span>
                                      {(isMakeup || l.is_late_cancellation) && (
                                        <div className="flex items-center gap-1">
                                          {isMakeup && (l.end_time
                                            ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase tracking-wider">✅ Reposição Feita</span>
                                            : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 uppercase tracking-wider">Reposição</span>
                                          )}
                                          {l.is_late_cancellation && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20 uppercase tracking-wider">Aviso Tardio</span>}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3.5 text-[var(--text-muted)] whitespace-nowrap">{formatTime(l.start_time)} – {formatTime(l.end_time)}</td>
                                  <td className="px-3 py-3.5 text-center"><span className="font-bold text-[var(--text-main)]">{l.duration_minutes || 0}</span><span className="text-[var(--text-lighter)] text-xs ml-0.5">min</span></td>
                                  <td className="px-3 py-3.5 text-center">
                                    {(l.is_late_cancellation || l.late_notice) && isMakeup ? (
                                      <button onClick={() => update(l.id, { extra_fee_paid: !l.extra_fee_paid })} disabled={updating === `extra_fee_paid_${l.id}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${l.extra_fee_paid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                                        {updating === `extra_fee_paid_${l.id}` ? <Loader2 size={12} className="animate-spin" /> : (l.extra_fee_paid ? <><CheckCircle2 size={12} /> Taxa Paga</> : 'Taxa Pendente')}
                                      </button>
                                    ) : (!lastPayDate || (l.class_date && l.class_date >= lastPayDate && !paidLessonIds.has(l.id))) && !l.is_absent ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                                        Pendente
                                      </span>
                                    ) : !l.is_absent ? (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        <CheckCircle2 size={12} /> Pago
                                      </span>
                                    ) : (
                                      <span className="text-[var(--text-lighter)] text-xs">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3.5 text-center">
                                    <button onClick={() => toggleAbsent(l.id, l.is_absent)} disabled={updating === `is_absent_${l.id}`}
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all hover:scale-110 active:scale-95 border ${l.is_absent ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-[var(--bg-input)] text-[var(--text-lighter)] border-[var(--border-color)] hover:text-emerald-400'}`}>
                                      {updating === `is_absent_${l.id}` ? <Loader2 size={14} className="animate-spin" /> : l.is_absent ? <CalendarX2 size={14} /> : <CalendarCheck size={14} />}
                                    </button>
                                  </td>
                                  <td className="px-3 py-3.5 text-center">
                                    {l.is_absent ? <input type="date" value={l.makeup_class_date || ''} onChange={e => update(l.id, { makeup_class_date: e.target.value || null })}
                                      className="bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] text-xs px-2 py-1.5 rounded-lg outline-none focus:border-[#5A77DF] transition-all w-32" />
                                    : <span className="text-[var(--text-lighter)] text-xs">—</span>}
                                  </td>
                                  <td className="px-3 py-3.5 text-center">
                                    <button onClick={() => toggleCheckin(l.id, 'professor_checkin', l.professor_checkin)} disabled={updating === `professor_checkin_${l.id}`}
                                      className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all hover:scale-110 active:scale-95 ${l.professor_checkin ? 'bg-[#5A77DF] text-white shadow-md shadow-[#5A77DF]/30' : 'bg-[var(--bg-input)] text-[var(--text-lighter)] border border-[var(--border-color)]'}`}>
                                      {updating === `professor_checkin_${l.id}` ? <Loader2 size={14} className="animate-spin" /> : l.professor_checkin ? <CheckCircle2 size={14} /> : <UserCheck size={14} />}
                                    </button>
                                  </td>
                                  <td className="px-3 py-3.5 text-center">
                                    <button onClick={() => toggleCheckin(l.id, 'student_checkin', l.student_checkin)} disabled={updating === `student_checkin_${l.id}`}
                                      className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all hover:scale-110 active:scale-95 ${l.student_checkin ? 'bg-[#5A77DF] text-white shadow-md shadow-[#5A77DF]/30' : 'bg-[var(--bg-input)] text-[var(--text-lighter)] border border-[var(--border-color)]'}`}>
                                      {updating === `student_checkin_${l.id}` ? <Loader2 size={14} className="animate-spin" /> : l.student_checkin ? <CheckCircle2 size={14} /> : <UserCheck size={14} />}
                                    </button>
                                  </td>
                                  {profile?.role === 'teacher' && (
                                    <td className="px-3 py-3.5 text-center">
                                      <button onClick={() => deleteLesson(l.id)} className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-[var(--text-lighter)] hover:text-red-500 hover:bg-red-500/10 transition-all">
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>

                        </table>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* --- TAB: PAGAMENTOS --- */}
        {activeTab === 'pagamentos' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl">
            {/* Registrar Pagamento */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div>
                <h3 className="font-bold text-[var(--text-main)] text-lg tracking-tight mb-1">Registrar Novo Pagamento</h3>
                <p className="text-xs text-[var(--text-muted)]">Atualiza o ciclo e reinicia uma contagem de 4 créditos.</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                  className="flex-1 sm:w-40 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm outline-none focus:border-[#5A77DF] transition-all" />
                <button onClick={registerPayment} disabled={savingPay || !payDate}
                  className="bg-[#5A77DF] text-white font-bold text-sm px-4 py-2 rounded-xl hover:bg-[#4a63be] disabled:opacity-50 flex items-center gap-1.5 active:scale-95 transition-all">
                  {savingPay ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
                </button>
              </div>
            </div>

            {/* Payment History Card */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm flex flex-col max-h-[400px]">
              <div className="flex items-center gap-2 mb-4 shrink-0">
                <div className="w-8 h-8 bg-[#5A77DF]/10 text-[#5A77DF] rounded-lg flex items-center justify-center"><History size={16} /></div>
                <h3 className="font-bold text-[var(--text-main)] text-sm tracking-tight">Histórico de Pagamentos</h3>
              </div>
              <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                {loadingExtras ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-[#5A77DF] w-5 h-5" /></div>
                ) : payHistory.length === 0 ? (
                  <p className="text-xs text-[var(--text-lighter)] text-center py-4 italic">Nenhum pagamento registrado.</p>
                ) : (
                  <div className="space-y-3">
                    {payHistory.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={14} />
                          </div>
                          <span className="font-bold text-[var(--text-main)] text-sm">
                            {new Date(p.payment_date + 'T00:00').toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB: COMPROVANTES --- */}
        {activeTab === 'comprovantes' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl">
            <PaymentReceipts studentId={student.id} isTeacher={true} />
          </div>
        )}

        {/* --- TAB: REAGENDAMENTOS --- */}
        {activeTab === 'reagendamentos' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Reschedule Form */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm h-fit">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-500/10 text-amber-500 rounded-lg flex items-center justify-center"><CalendarClock size={16} /></div>
                  <h3 className="font-bold text-[var(--text-main)] text-sm tracking-tight">Nova Solicitação</h3>
                </div>
              </div>
              
              <form onSubmit={handleReschedule}>
                <div className="mb-4">
                  <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest mb-1 block">Título da Aula</label>
                  <input type="text" value={resForm.title} onChange={e => setResForm({...resForm, title: e.target.value})} placeholder="Ex: Aula de Reposição" className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm outline-none focus:border-amber-500 transition-all" required />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest mb-1 block">Nova Data</label>
                    <input type="date" value={resForm.new_date} onChange={e => setResForm({...resForm, new_date: e.target.value})} className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm outline-none focus:border-amber-500 transition-all" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest mb-1 block">Novo Início</label>
                    <input type="time" value={resForm.new_start_time} onChange={e => setResForm({...resForm, new_start_time: e.target.value})} className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm outline-none focus:border-amber-500 transition-all" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest mb-1 block">Novo Fim</label>
                    <input type="time" value={resForm.new_end_time} onChange={e => setResForm({...resForm, new_end_time: e.target.value})} className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm outline-none focus:border-amber-500 transition-all"  />
                  </div>
                </div>

                <div className="mb-4 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={resForm.is_late} onChange={e => setResForm({...resForm, is_late: e.target.checked})} className="accent-amber-500 w-4 h-4 cursor-pointer" />
                    <span className="text-xs font-bold text-amber-500">Aviso tardio (-3h de antecedência)</span>
                  </label>
                  <p className="text-[10px] text-[var(--text-muted)] leading-tight pl-6">
                    Se marcado, a aula será mantida na data original com status de falta (consumindo um crédito). Caso desmarcado, a aula será movida livremente para a nova data sem penalidade.
                  </p>
                </div>

                <div className="mb-6">
                  <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest mb-1 block">Motivo (Opcional)</label>
                  <input type="text" value={resForm.reason} onChange={e => setResForm({...resForm, reason: e.target.value})} placeholder="Ex: Problemas de internet..." className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm outline-none focus:border-amber-500 transition-all" />
                </div>
                
                <button type="submit" disabled={savingRes || !resForm.new_date || !resForm.new_start_time} className="w-full bg-amber-500 text-white font-bold text-sm py-3 rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-all flex justify-center items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95">
                  {savingRes ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar Reagendamento
                </button>
              </form>
            </div>

            {/* Rescheduled Lessons Card */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm flex flex-col max-h-[600px]">
              <div className="flex items-center gap-2 mb-4 shrink-0">
                <div className="w-8 h-8 bg-amber-500/10 text-amber-500 rounded-lg flex items-center justify-center"><History size={16} /></div>
                <h3 className="font-bold text-[var(--text-main)] text-sm tracking-tight">Histórico de Reagendamentos</h3>
              </div>
              
              <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                {loadingExtras ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-amber-500 w-5 h-5" /></div>
                ) : rescheduled.length === 0 ? (
                  <p className="text-xs text-[var(--text-lighter)] text-center py-4 italic">Nenhum reagendamento registrado.</p>
                ) : (
                  <div className="space-y-3">
                    {rescheduled.map(r => (
                      <div key={r.id} className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] flex flex-col gap-2 relative overflow-hidden">
                        {r.is_late && (
                          <div className="absolute top-0 right-0 bg-red-500/10 text-red-400 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
                            Late Cancel
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-[var(--text-main)] text-xs px-2.5 py-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-sm">
                            {new Date(r.original_date + 'T00:00').toLocaleDateString('pt-BR')}
                          </span>
                          <ArrowRight size={14} className="text-[var(--text-lighter)]" />
                          <span className="font-bold text-emerald-400 text-xs px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg shadow-sm">
                            {new Date(r.new_date + 'T00:00').toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        {r.reason && (
                          <div className="flex items-start gap-1.5 mt-1">
                            <FileText size={12} className="text-[var(--text-lighter)] mt-0.5 shrink-0" />
                            <span className="text-[11px] text-[var(--text-muted)] italic leading-tight">{r.reason}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}