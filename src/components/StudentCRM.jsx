import { useState, useMemo } from 'react'; // <--- ADICIONAMOS O useMemo AQUI
import { supabase } from '../supabase';
import StudentDetail from './StudentDetail';
import { 
  Users, Clock, Loader2, ChevronRight, Package, Plus, X 
} from 'lucide-react';
import { useLessonsRealtime } from '../hooks/useLessonsRealtime';

export default function StudentCRM({ profile, students, isDarkMode, fetchStudents }) { // Adicionei o fetchStudents aqui
  const [activeStudent, setActiveStudent] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [newStudent, setNewStudent] = useState({ email: '', password: '', name: '' });

  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { lessons: allLessons } = useLessonsRealtime({});
  const { lessons, loading } = useLessonsRealtime({ referenceMonth: curMonth });

 const createStudent = async () => {
    if (!newStudent.name || !newStudent.email || !newStudent.password) return alert("Preencha todos os campos!");
    setLoadingAdd(true);
    try {
      // Chamamos a Edge Function que criamos no passo anterior
      const { data, error } = await supabase.functions.invoke('create-student', {
        body: { 
          email: newStudent.email, 
          password: newStudent.password, 
          name: newStudent.name 
        }
      });

      if (error) throw error;
      
      alert("Aluno cadastrado com sucesso!");
      setIsAddModalOpen(false);
      setNewStudent({ email: '', password: '', name: '' });
      
      // Atualiza a lista de alunos sem recarregar a página
      fetchStudents(); 
    } catch (e) { 
      alert("Erro ao cadastrar: " + e.message); 
    } finally { 
      setLoadingAdd(false); 
    }
  };

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

  if (activeStudent) {
    return <StudentDetail student={activeStudent} profile={profile} onBack={() => setActiveStudent(null)} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 lg:p-12 animate-in fade-in duration-500">
      <div className="max-w-5xl mx-auto w-full pt-16 lg:pt-0">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[var(--icon-bg)] text-[var(--icon-color)] rounded-xl flex items-center justify-center shadow-sm">
                <Users size={20} />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-main)]">Student CRM</h1>
            </div>
            <p className="text-[var(--text-muted)] text-sm">Manage attendance, hours, and payments</p>
          </div>
          <button onClick={() => setIsAddModalOpen(true)} className="bg-[#5A77DF] text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-[#4a63be] transition-all shadow-lg active:scale-95 text-sm">
            <Plus size={18}/> Novo Aluno
          </button>
        </header>

        {loading && <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-[#5A77DF]" /></div>}

        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {studentSummaries.map(({ student, hours, lessons: count, remaining }) => (
               <div key={student.id} onClick={() => setActiveStudent(student)}
                 className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all group relative overflow-hidden">
                 <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5A77DF] to-[#8B5CF6] opacity-40" />
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-[var(--icon-bg)] text-[var(--icon-color)] rounded-xl flex items-center justify-center text-lg font-bold">{student.full_name?.charAt(0)}</div>
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-main)]">{student.full_name}</h3>
                        <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-bold">{count} lesson{count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-lighter)]" />
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-[#5A77DF]/10 text-[#5A77DF] px-2.5 py-1 rounded-lg border border-[#5A77DF]/20"><Clock size={11} className="inline mr-1" />{hours}h</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${remaining > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}><Package size={11} className="inline mr-1" />{remaining > 0 ? `${remaining}/4 restam` : 'Renovar'}</span>
                 </div>
               </div>
            ))}
          </div>
        )}

        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-[var(--bg-card)] p-8 rounded-3xl w-full max-w-sm border border-[var(--border-color)] shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-bold text-xl">Novo Aluno</h2>
                <button onClick={() => setIsAddModalOpen(false)}><X size={20}/></button>
              </div>
              <div className="space-y-4">
                <input placeholder="Nome Completo" onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="w-full p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]" />
                <input placeholder="Email" onChange={e => setNewStudent({...newStudent, email: e.target.value})} className="w-full p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]" />
                <input type="password" placeholder="Senha Provisória" onChange={e => setNewStudent({...newStudent, password: e.target.value})} className="w-full p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]" />
              </div>
              <button onClick={createStudent} disabled={loadingAdd} className="w-full py-4 mt-6 bg-[#5A77DF] text-white rounded-xl font-bold flex items-center justify-center gap-2">
                {loadingAdd ? <Loader2 className="animate-spin" size={18}/> : 'Cadastrar Aluno'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}