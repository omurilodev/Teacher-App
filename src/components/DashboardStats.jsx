import { useMemo } from 'react';
import { useLessonsRealtime } from '../hooks/useLessonsRealtime';
import { Users, Clock, AlertTriangle, AlertCircle } from 'lucide-react';

export default function DashboardStats({ students }) {
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { lessons: allLessons, loading: allLoading } = useLessonsRealtime({});
  const { lessons: monthLessons, loading: monthLoading } = useLessonsRealtime({ referenceMonth: curMonth });

  const stats = useMemo(() => {
    let totalMin = 0;
    let yellowCount = 0;
    let redCount = 0;

    const map = {};
    (students || []).forEach(s => {
      map[s.id] = { student: s, remaining: 0 };
    });

    (monthLessons || []).forEach(l => {
      totalMin += l.duration_minutes || 0;
    });

    Object.values(map).forEach(m => {
      const lpd = m.student.last_payment_date;
      if (!lpd) {
        m.remaining = 0; 
      } else {
        const sAll = (allLessons || []).filter(l => l.student_id === m.student.id);
        const consumed = sAll.filter(l =>
          l.class_date && l.class_date >= lpd && (
            (!l.is_makeup && !l.is_absent && l.end_time) ||
            (l.is_absent && l.late_notice) ||
            (l.is_makeup && !l.late_notice && l.end_time)
          )
        ).length;
        m.remaining = Math.max(0, 4 - consumed);
      }

      if (m.remaining === 0) redCount++;
      else if (m.remaining === 1) yellowCount++;
    });

    return {
      activeStudents: (students || []).length,
      totalMinutes: totalMin,
      yellowAlerts: yellowCount,
      redAlerts: redCount
    };
  }, [students, monthLessons, allLessons]);

  if (allLoading || monthLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm flex items-center gap-4 h-[88px] animate-pulse">
             <div className="w-12 h-12 rounded-xl bg-[var(--bg-input)]"></div>
             <div className="flex-1 space-y-2">
                <div className="h-3 bg-[var(--bg-input)] rounded w-1/2"></div>
                <div className="h-5 bg-[var(--bg-input)] rounded w-1/4"></div>
             </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
          <Users size={24} />
        </div>
        <div>
          <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest">Alunos Ativos</p>
          <p className="text-2xl font-bold text-[var(--text-main)]">{stats.activeStudents}</p>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
          <Clock size={24} />
        </div>
        <div>
          <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest">Minutos no Mês</p>
          <p className="text-2xl font-bold text-[var(--text-main)]">{stats.totalMinutes}</p>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm flex flex-col justify-center">
        <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest mb-3">Alertas de Pagamento</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
               <AlertCircle size={16} />
             </div>
             <div className="flex flex-col">
               <span className="text-lg font-bold text-[var(--text-main)] leading-none mb-0.5">{stats.redAlerts}</span>
               <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Atrasados</span>
             </div>
          </div>
          
          <div className="w-px h-6 bg-[var(--border-color)]"></div>
          
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
               <AlertTriangle size={16} />
             </div>
             <div className="flex flex-col">
               <span className="text-lg font-bold text-[var(--text-main)] leading-none mb-0.5">{stats.yellowAlerts}</span>
               <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-bold">3ª/4ª Aula</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
