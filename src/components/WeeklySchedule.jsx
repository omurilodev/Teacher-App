import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { showAlert } from './AlertModal'
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, Clock, CalendarPlus, X } from 'lucide-react'

const DAY_LABELS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DAY_SHORT  = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS     = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function getMondayOf(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow))
  return d
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatRange(monday) {
  const sat = new Date(monday)
  sat.setDate(monday.getDate() + 5)
  return `${monday.getDate()} ${MONTHS[monday.getMonth()]} — ${sat.getDate()} ${MONTHS[sat.getMonth()]} ${sat.getFullYear()}`
}

function resolveStatus(swl, dateStr, todayStr) {
  const dailyLessons = swl.filter(l => l.class_date === dateStr)

  const makeupDone = dailyLessons.find(l => l.is_makeup && l.end_time !== null && l.end_time !== undefined)
  if (makeupDone) return 'reposition_done'

  if (dailyLessons.some(l => l.end_time !== null && l.end_time !== undefined)) return 'done'

  const makeupLesson = dailyLessons.find(l => l.is_makeup)
  if (makeupLesson) return (makeupLesson.late_notice || makeupLesson.is_late_cancellation) ? 'late_makeup' : 'makeup'

  if (dailyLessons.some(l => l.is_absent)) return 'absent'

  if (dateStr < todayStr) return 'missed'
  return 'pending'
}

const STATUS_CFG = {
  done:             { label: 'Realizada',          card: 'bg-emerald-500/10 border-emerald-500',     badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  reposition_done:  { label: '✅ Reposição Feita', card: 'bg-emerald-500/10 border-emerald-500',     badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  makeup:           { label: 'Reposição',          card: 'bg-yellow-400/10 border-yellow-400',       badge: 'bg-yellow-400/20 text-yellow-600 border-yellow-400/30' },
  late_makeup:      { label: 'Reposição (Atraso)', card: 'bg-red-500/10 border-red-500',             badge: 'bg-red-500/15 text-red-500 border-red-500/30' },
  absent:           { label: 'Falta',              card: 'bg-red-500/10 border-red-500',             badge: 'bg-red-500/15 text-red-500 border-red-500/30' },
  missed:           { label: 'Falta',              card: 'bg-red-500/5 border-red-400/40',           badge: 'bg-red-400/10 text-red-400/70 border-red-400/20' },
  pending:          { label: 'Pendente',           card: 'bg-[var(--bg-app)]/40 border-[var(--border-color)]', badge: 'bg-transparent text-[var(--text-lighter)] border-[var(--border-color)]' },
}

export default function WeeklySchedule({ students, isDarkMode }) {
  const [schedules, setSchedules]       = useState([])
  const [weekLessons, setWeekLessons]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [weekOffset, setWeekOffset]     = useState(0)
  const [makeupSlotId, setMakeupSlotId] = useState(null)
  const [makeupForm, setMakeupForm]     = useState({ date: '', time: '', lateNotice: false })
  const [savingMakeup, setSavingMakeup] = useState(false)

  const monday = useMemo(() => {
    const base = new Date()
    base.setDate(base.getDate() + weekOffset * 7)
    return getMondayOf(base)
  }, [weekOffset])

  const saturdayStr = useMemo(() => {
    const s = new Date(monday)
    s.setDate(monday.getDate() + 5)
    return toDateStr(s)
  }, [monday])

  useEffect(() => {
    supabase.from('schedules').select('id, student_id, day_of_week, start_time')
      .then(({ data }) => setSchedules(data || []))
  }, [])

  useEffect(() => {
    async function fetchLessons() {
      setLoading(true)
      const { data } = await supabase.from('lessons')
        .select('id, student_id, class_date, is_makeup, is_absent, start_time, end_time, late_notice, is_late_cancellation')
        .gte('class_date', toDateStr(monday))
        .lte('class_date', saturdayStr)
      setWeekLessons(data || [])
      setLoading(false)
    }
    fetchLessons()
  }, [monday, saturdayStr])

  const todayStr = toDateStr(new Date())

  const createMakeup = async (student, originalDateStr, scheduleItem) => {
    if (!makeupForm.date || !makeupForm.time) {
      showAlert('Atenção', 'Preencha a data e o horário.', 'info')
      return
    }
    setSavingMakeup(true)

    try {
      // 1. Insert the makeup lesson for the new date
      const { data: makeupLesson, error: makeupError } = await supabase.from('lessons').insert({
        student_id:           student.id,
        is_makeup:            true,
        class_date:           makeupForm.date,
        start_time:           makeupForm.time + ':00',
        title:                `Reposição — ${student.full_name}`,
        reference_month:      makeupForm.date.substring(0, 7),
        late_notice:          makeupForm.lateNotice,
        is_late_cancellation: makeupForm.lateNotice,
        extra_fee_paid:       false,
      }).select('id, student_id, class_date, is_makeup, is_absent, start_time, end_time, late_notice, is_late_cancellation').single()

      if (makeupError) throw makeupError

      // 2. Handle the absence on the original date
      let updatedOriginal = null
      let insertedOriginal = null

      if (makeupForm.lateNotice && originalDateStr && scheduleItem && !scheduleItem.id.startsWith('makeup-')) {
        // Try to find an existing non-absent, non-makeup lesson for the original date
        const { data: existing } = await supabase.from('lessons')
          .select('id, student_id, class_date, is_makeup, is_absent, start_time, end_time, late_notice, is_late_cancellation')
          .eq('student_id', student.id)
          .eq('class_date', originalDateStr)
          .eq('is_makeup', false)
          .eq('is_absent', false)
          .maybeSingle()

        if (existing) {
          // UPDATE the existing lesson to mark it absent
          const { error: updateError } = await supabase.from('lessons')
            .update({ is_absent: true, late_notice: true, is_late_cancellation: true })
            .eq('id', existing.id)
          if (updateError) throw updateError
          updatedOriginal = { ...existing, is_absent: true, late_notice: true, is_late_cancellation: true }
        } else {
          // INSERT a new absence lesson (no pre-existing lesson found)
          const { data: newAbsence, error: insertError } = await supabase.from('lessons').insert({
            student_id:           student.id,
            class_date:           originalDateStr,
            start_time:           scheduleItem.start_time,
            is_absent:            true,
            late_notice:          true,
            is_late_cancellation: true,
            title:                `Falta — ${student.full_name}`,
            reference_month:      originalDateStr.substring(0, 7),
          }).select('id, student_id, class_date, is_makeup, is_absent, start_time, end_time, late_notice, is_late_cancellation').single()
          if (insertError) throw insertError
          insertedOriginal = newAbsence
        }
      }

      // 3. Update local state
      setWeekLessons(prev => {
        let next = updatedOriginal
          ? prev.map(l => l.id === updatedOriginal.id ? updatedOriginal : l)
          : insertedOriginal
            ? [...prev, insertedOriginal]
            : [...prev]
        return [...next, makeupLesson]
      })
      setMakeupSlotId(null)
      setMakeupForm({ date: '', time: '', lateNotice: false })
      showAlert('Sucesso', 'Reposição processada!', 'success')
    } catch (err) {
      showAlert('Erro', err.message, 'error')
    } finally {
      setSavingMakeup(false)
    }
  }

  const grid = useMemo(() => (
    Array.from({ length: 6 }, (_, i) => {
      const dayDate = new Date(monday)
      dayDate.setDate(monday.getDate() + i)
      const dateStr = toDateStr(dayDate)

      const fixedStudentIds = new Set()
      const fixedSlots = schedules
        .filter(s => s.day_of_week === i + 1)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
        .map(sched => {
          const student = (students || []).find(st => st.id === sched.student_id)
          if (!student) return null
          fixedStudentIds.add(sched.student_id)
          const swl    = weekLessons.filter(l => l.student_id === sched.student_id)
          const status = resolveStatus(swl, dateStr, todayStr)
          
          // LÓGICA: Se houver reposição mapeada no dia fixo, exibe o horário da reposição
          const dailyLessons = swl.filter(l => l.class_date === dateStr)
          const makeupLesson = dailyLessons.find(l => l.is_makeup)
          const displayStartTime = makeupLesson?.start_time ? makeupLesson.start_time : sched.start_time

          return { 
            schedule: { ...sched, start_time: displayStartTime }, 
            student, 
            status, 
            isExtra: false, 
            dateStr 
          }
        })
        .filter(Boolean)

      const extraSlots = weekLessons
        .filter(l => l.is_makeup && l.class_date === dateStr && !fixedStudentIds.has(l.student_id))
        .map(lesson => {
          const student = (students || []).find(st => st.id === lesson.student_id)
          if (!student) return null
          return {
            schedule: { id: `makeup-${lesson.id}`, student_id: lesson.student_id, start_time: lesson.start_time || '00:00' },
            student,
            status: (lesson.late_notice || lesson.is_late_cancellation) ? 'late_makeup' : 'makeup',
            isExtra: true,
            dateStr
          }
        })
        .filter(Boolean)

      const slots = [...fixedSlots, ...extraSlots]
      const doneCount = slots.filter(s => s.status === 'done' || s.status === 'makeup' || s.status === 'late_makeup').length
      return { dayIndex: i, dateStr, isToday: dateStr === todayStr, slots, doneCount }
    })
  ), [schedules, weekLessons, students, monday, todayStr])

  const SlotDesktop = ({ schedule, student, status, isExtra, dateStr }) => {
    const cfg    = STATUS_CFG[status]
    const isOpen = makeupSlotId === schedule.id
    return (
      <div className={`rounded-xl border-l-4 p-2 flex flex-col gap-1.5 ${cfg.card}`}>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-[#5A77DF]/20 text-[#5A77DF] rounded-md flex items-center justify-center text-[9px] font-bold shrink-0">
            {student.full_name?.charAt(0)}
          </div>
          <p className="text-[10px] font-bold text-[var(--text-main)] truncate leading-none flex-1">
            {student.full_name?.split(' ')[0]}
          </p>
          {!isExtra && (
            <button
              onClick={() => { setMakeupSlotId(isOpen ? null : schedule.id); setMakeupForm({ date: '', time: '', lateNotice: false }) }}
              className="text-[var(--text-lighter)] hover:text-[#5A77DF] transition-colors shrink-0"
              title="Criar reposição"
            >
              {isOpen ? <X size={10} /> : <CalendarPlus size={10} />}
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          <span className="flex items-center gap-0.5 text-[9px] text-[var(--text-muted)]">
            <Clock size={8} />{schedule.start_time?.substring(0, 5) || '00:00'}
          </span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
        {isOpen && (
          <div className="flex flex-col gap-1.5 pt-1.5 border-t border-[var(--border-color)]/40">
            <input
              type="date"
              value={makeupForm.date}
              onChange={e => setMakeupForm(prev => ({ ...prev, date: e.target.value }))}
              className="w-full text-[9px] px-1.5 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)]"
            />
            <input
              type="time"
              value={makeupForm.time}
              onChange={e => setMakeupForm(prev => ({ ...prev, time: e.target.value }))}
              className="w-full text-[9px] px-1.5 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)]"
            />
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={makeupForm.lateNotice}
                onChange={e => setMakeupForm(prev => ({ ...prev, lateNotice: e.target.checked }))}
                className="w-3 h-3 accent-amber-500 cursor-pointer"
              />
              <span className={`text-[9px] leading-tight ${makeupForm.lateNotice ? 'text-amber-500 font-bold' : 'text-[var(--text-muted)]'}`}>
                Aviso &lt; 3h
              </span>
            </label>
            <button
              onClick={() => createMakeup(student, dateStr, schedule)}
              disabled={savingMakeup}
              className="w-full text-[9px] font-bold py-1 rounded-lg bg-[#5A77DF] text-white hover:bg-[#4a63be] transition-all disabled:opacity-50 flex items-center justify-center gap-0.5"
            >
              {savingMakeup ? <Loader2 size={8} className="animate-spin" /> : 'Confirmar'}
            </button>
          </div>
        )}
      </div>
    )
  }

  const SlotMobile = ({ schedule, student, status, isExtra, dateStr }) => {
    const cfg    = STATUS_CFG[status]
    const isOpen = makeupSlotId === schedule.id
    return (
      <div className={`rounded-xl border-l-4 px-3 py-2.5 flex flex-col gap-2 ${cfg.card}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#5A77DF]/15 text-[#5A77DF] rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
              {student.full_name?.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-main)]">{student.full_name}</p>
              <p className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                <Clock size={9} />{schedule.start_time?.substring(0, 5) || '00:00'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${cfg.badge}`}>
              {cfg.label}
            </span>
            {!isExtra && (
              <button
                onClick={() => { setMakeupSlotId(isOpen ? null : schedule.id); setMakeupForm({ date: '', time: '', lateNotice: false }) }}
                className="p-1.5 rounded-lg text-[var(--text-lighter)] hover:text-[#5A77DF] hover:bg-[#5A77DF]/10 transition-all"
                title="Criar reposição"
              >
                {isOpen ? <X size={14} /> : <CalendarPlus size={14} />}
              </button>
            )}
          </div>
        </div>
        {isOpen && (
          <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-color)]/40">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Criar Reposição</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={makeupForm.date}
                onChange={e => setMakeupForm(prev => ({ ...prev, date: e.target.value }))}
                className="text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)]"
              />
              <input
                type="time"
                value={makeupForm.time}
                onChange={e => setMakeupForm(prev => ({ ...prev, time: e.target.value }))}
                className="text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)]"
              />
            </div>
            <label className={`flex items-center gap-2 cursor-pointer select-none px-2 py-1.5 rounded-lg transition-all ${makeupForm.lateNotice ? 'bg-amber-400/10' : ''}`}>
              <input
                type="checkbox"
                checked={makeupForm.lateNotice}
                onChange={e => setMakeupForm(prev => ({ ...prev, lateNotice: e.target.checked }))}
                className="w-4 h-4 accent-amber-500 cursor-pointer shrink-0"
              />
              <span className={`text-xs ${makeupForm.lateNotice ? 'text-amber-500 font-bold' : 'text-[var(--text-muted)]'}`}>
                Aviso com menos de 3h de antecedência
              </span>
            </label>
            <button
              onClick={() => createMakeup(student, dateStr, schedule)}
              disabled={savingMakeup}
              className="w-full text-xs font-bold py-2 rounded-lg bg-[#5A77DF] text-white hover:bg-[#4a63be] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {savingMakeup && <Loader2 size={12} className="animate-spin" />}
              Confirmar Reposição
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[var(--icon-bg)] text-[var(--icon-color)] rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <CalendarDays size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[var(--text-main)]">Agenda Semanal</h2>
            <p className="text-[var(--text-muted)] text-xs">{formatRange(monday)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:shadow-sm transition-all">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setWeekOffset(0)} className="px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:shadow-sm transition-all">
            Hoje
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:shadow-sm transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-14"><Loader2 className="animate-spin w-7 h-7 text-[#5A77DF]" /></div>
      ) : (
        <>
          <div className="hidden md:grid grid-cols-6 gap-2.5">
            {grid.map(({ dayIndex, dateStr, isToday, slots, doneCount }) => (
              <div
                key={dayIndex}
                className={`rounded-2xl border p-3 min-h-[150px] transition-all ${
                  isToday ? 'bg-[#5A77DF]/5 border-[#5A77DF]/40 shadow-sm' : 'bg-[var(--bg-card)] border-[var(--border-color)]'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? 'text-[#5A77DF]' : 'text-[var(--text-muted)]'}`}>
                      {DAY_SHORT[dayIndex]}
                    </p>
                    <p className={`text-xl font-bold leading-tight mt-0.5 ${isToday ? 'text-[#5A77DF]' : 'text-[var(--text-main)]'}`}>
                      {new Date(dateStr + 'T12:00:00').getDate()}
                    </p>
                  </div>
                  {slots.length > 0 && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-0.5 ${
                      doneCount === slots.length && slots.length > 0
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : 'bg-[var(--bg-app)] text-[var(--text-muted)]'
                    }`}>
                      {doneCount}/{slots.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {slots.length === 0
                    ? <p className="text-[var(--text-lighter)] text-[10px] text-center py-4 opacity-40">—</p>
                    : slots.map(slot => <SlotDesktop key={slot.schedule.id} {...slot} />)
                  }
                </div>
              </div>
            ))}
          </div>

          <div className="md:hidden flex flex-col gap-2.5">
            {grid.map(({ dayIndex, dateStr, isToday, slots, doneCount }) => (
              <div
                key={dayIndex}
                className={`rounded-2xl border p-4 transition-all ${
                  isToday ? 'bg-[#5A77DF]/5 border-[#5A77DF]/40' : 'bg-[var(--bg-card)] border-[var(--border-color)]'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 ${isToday ? 'bg-[#5A77DF] text-white' : 'bg-[var(--bg-app)] text-[var(--text-main)]'}`}>
                    <span className="text-[8px] font-bold uppercase tracking-wide leading-none">{DAY_SHORT[dayIndex]}</span>
                    <span className="text-sm font-bold leading-none mt-0.5">{new Date(dateStr + 'T12:00:00').getDate()}</span>
                  </div>
                  <p className={`font-bold text-sm ${isToday ? 'text-[#5A77DF]' : 'text-[var(--text-main)]'}`}>
                    {DAY_LABELS[dayIndex]}
                  </p>
                  {slots.length > 0 && (
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-lg ${
                      doneCount === slots.length && slots.length > 0
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : 'bg-[var(--bg-app)] text-[var(--text-muted)]'
                    }`}>
                      {doneCount}/{slots.length}
                    </span>
                  )}
                </div>
                {slots.length === 0
                  ? <p className="text-[var(--text-lighter)] text-xs opacity-50">Sem aulas fixas</p>
                  : <div className="flex flex-col gap-2">{slots.map(slot => <SlotMobile key={slot.schedule.id} {...slot} />)}</div>
                }
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}