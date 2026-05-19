import { useState, useMemo } from 'react';
import { supabase } from '../supabase';
import { useLessonsRealtime } from '../hooks/useLessonsRealtime';
import StudentDetail from './StudentDetail';
import {
  Users, Clock, Loader2, ChevronRight, Package
} from 'lucide-react';


export default function StudentCRM({ profile, students, isDarkMode }) {
  const [activeStudent, setActiveStudent] = useState(null);

  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Fetch ALL lessons (no month filter) for cycle calculation
  const { lessons: allLessons } = useLessonsRealtime({});
  // Also month-scoped for hours display
  const { lessons, loading } = useLessonsRealtime({ referenceMonth: curMonth });

  // Aggregate per student
  const studentSummaries = useMemo(() => {
    const map = {};
    (students || []).forEach(s => {
      map[s.id] = { student: s, totalMin: 0, hours: '0.0', lessons: 0, remaining: 0 };
    });
    (lessons || []).forEach(l => {
      const sid = l.student_id;
      if (!map[sid]) return;
      map[sid].totalMin += l.duration_minutes || 0;
      map[sid].lessons++;
    });
    // Calculate hours + profile-based package cycle per student
    Object.values(map).forEach(m => {
      m.hours = (m.totalMin / 60).toFixed(1);
      const lpd = m.student.last_payment_date;
      if (!lpd) {
        m.remaining = 0;
      } else {
        const sAll = (allLessons || []).filter(l => l.student_id === m.student.id);
        const consumed = sAll.filter(l => !l.is_absent && l.class_date && l.class_date >= lpd).length;
        m.remaining = Math.max(0, 4 - consumed);
      }
    });
    return Object.values(map).sort((a, b) => b.lessons - a.lessons || (a.student.full_name || '').localeCompare(b.student.full_name || ''));
  }, [students, lessons, allLessons]);

  // Detail view
  if (activeStudent) {
    return <StudentDetail student={activeStudent} profile={profile} onBack={() => setActiveStudent(null)} />;
  }

  // Main list view
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 lg:p-12 animate-in fade-in duration-500">
      <div className="max-w-5xl mx-auto w-full pt-16 lg:pt-0">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[var(--icon-bg)] text-[var(--icon-color)] rounded-xl flex items-center justify-center shadow-sm">
              <Users size={20} />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-main)]">Student CRM</h1>
          </div>
          <p className="text-[var(--text-muted)] text-sm">Manage attendance, hours, and payments</p>
        </header>

        {loading && (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-[#5A77DF]" /></div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {studentSummaries.map(({ student, hours, lessons: count, remaining }) => {
               return (
                <div key={student.id} onClick={() => setActiveStudent(student)}
                  className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all group relative overflow-hidden">
                  {/* Accent top bar */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5A77DF] to-[#8B5CF6] opacity-40 group-hover:opacity-100 transition-opacity" />

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-[var(--icon-bg)] text-[var(--icon-color)] rounded-xl flex items-center justify-center text-lg font-bold group-hover:bg-[#5A77DF] group-hover:text-white transition-all shadow-sm shrink-0">
                        {student.full_name?.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-main)] tracking-tight">{student.full_name}</h3>
                        <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-bold mt-0.5">
                          {count} lesson{count !== 1 ? 's' : ''} this month
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-lighter)] group-hover:text-[#5A77DF] transition-colors shrink-0" />
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Hours badge */}
                    <span className="flex items-center gap-1.5 text-xs font-bold bg-[#5A77DF]/10 text-[#5A77DF] px-2.5 py-1 rounded-lg border border-[#5A77DF]/20">
                      <Clock size={11} /> {hours}h
                    </span>
                    {/* Package badge */}
                    <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border ${remaining > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      <Package size={11} /> {remaining > 0 ? `${remaining}/4 restam` : 'Renovar'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && studentSummaries.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-[var(--bg-card)] rounded-3xl shadow-sm border border-[var(--border-color)] flex items-center justify-center mb-6 mx-auto">
              <Users size={36} className="text-[var(--text-lighter)] opacity-40" />
            </div>
            <p className="text-[var(--text-lighter)] text-sm font-bold tracking-tight">No students found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
