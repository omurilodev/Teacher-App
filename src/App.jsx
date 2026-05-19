import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import StudentCRM from './components/StudentCRM'
import VocabularyDeck from './components/VocabularyDeck'
import { 
  BookOpen, LogOut, LayoutDashboard, 
  Send, ArrowLeft, Loader2, Plus, Save, 
  X, Pencil, Trash2, AlertTriangle, 
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  MessageSquare, Sun, Moon, Menu, ChevronRight, BookText, Users, Clock, CheckCircle2
} from 'lucide-react'
import CollaborativeEditor from './components/CollaborativeEditor';
import DashboardStats from './components/DashboardStats';
import AlertModal from './components/AlertModal';

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [lessons, setLessons] = useState([])
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isLessonListOpen, setIsLessonListOpen] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(true) 
  const [isCheckingIn, setIsCheckingIn] = useState(false) 
  const [currentView, setCurrentView] = useState('dashboard')

  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(null)
  
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editClassDate, setEditClassDate] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')

  const [unreadByStudent, setUnreadByStudent] = useState({}) 
  const [unreadByLesson, setUnreadByLesson] = useState({})   

  const messagesEndRef = useRef(null)

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('theme') === 'dark';
    return false;
  });

  const [loginEmail, setLoginEmail] = useState(''); 
  const [loginPassword, setLoginPassword] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isMobileChatOpen, isChatOpen]);

  const fetchUnreadStatus = useCallback(async (userProfile) => {
    if (!userProfile) return;
    try {
      const { data: lessonsData } = await supabase.from('lessons').select('id, student_id');
      const { data: unreadData } = await supabase.from('messages')
        .select('lesson_id')
        .eq('is_read', false)
        .neq('sender_id', userProfile.id);

      if (unreadData && lessonsData) {
        const studentDots = {};
        const lessonDots = {};
        unreadData.forEach(msg => {
          lessonDots[msg.lesson_id] = true;
          const lesson = lessonsData.find(l => l.id === msg.lesson_id);
          if (lesson) studentDots[lesson.student_id] = true;
        });
        setUnreadByStudent(studentDots);
        setUnreadByLesson(lessonDots);
      }
    } catch (e) { console.log(e); }
  }, []);

  const markMessagesAsRead = useCallback(async (lessonId) => {
    if (!profile || !lessonId) return;
    await supabase.from('messages')
      .update({ is_read: true })
      .eq('lesson_id', lessonId)
      .neq('sender_id', profile.id);
    fetchUnreadStatus(profile);
  }, [profile, fetchUnreadStatus]);

  useEffect(() => {
    if ((isMobileChatOpen || isChatOpen) && selectedLesson) {
      markMessagesAsRead(selectedLesson.id);
    }
  }, [isMobileChatOpen, isChatOpen, selectedLesson, markMessagesAsRead]);

  const fetchStudents = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'student'); 
    setStudents(data || []);
  }, []);

  const fetchMyLessons = useCallback(async (uid) => {
    const { data } = await supabase.from('lessons').select('*').eq('student_id', uid).order('created_at', { ascending: false });
    setLessons(data || []);
  }, []);

  const fetchProfile = useCallback(async (uid, isInitialLogin = false) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data); 
    
    if (data?.role === 'teacher') fetchStudents();
    else if (data?.role === 'student') fetchMyLessons(uid);
    
    if (isInitialLogin) {
      setCurrentView(data?.role === 'teacher' ? 'dashboard' : 'journal');
    }
    
    await fetchUnreadStatus(data); 
    setLoading(false);
  }, [fetchStudents, fetchMyLessons, fetchUnreadStatus]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); 
      if (session) fetchProfile(session.user.id, true); 
      else setLoading(false);
    })
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session); 
      if (session) {
        const isInitial = event === 'SIGNED_IN' || event === 'INITIAL_SESSION';
        fetchProfile(session.user.id, isInitial); 
      } else { 
        setProfile(null); 
        setLoading(false); 
      }
    })
    return () => subscription.unsubscribe()
  }, [fetchProfile])

  useEffect(() => {
    if (!profile) return;
    const globalChannel = supabase.channel('global_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, 
      () => { fetchUnreadStatus(profile); }).subscribe();
    return () => { supabase.removeChannel(globalChannel) }
  }, [profile, fetchUnreadStatus]);

  useEffect(() => {
    if (!selectedLesson) return
    const channel = supabase.channel(`chat_room_${selectedLesson.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `lesson_id=eq.${selectedLesson.id}` }, 
      (payload) => {
        setMessages((prev) => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
        if (isMobileChatOpen || (isChatOpen && window.innerWidth >= 1024 && selectedLesson)) {
           markMessagesAsRead(selectedLesson.id);
        }
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedLesson, isMobileChatOpen, isChatOpen, markMessagesAsRead])

  async function selectLesson(lesson, mode = 'view') {
    if (!lesson || !lesson.id) return; 

    setIsMobileMenuOpen(false);
    if (window.innerWidth < 1024) setIsLessonListOpen(false);

    setIsCreating(false); setMessages([]); setSelectedLesson(lesson);
    if (mode === 'edit') { 
      setIsEditing(true); setEditTitle(lesson.title); setEditContent(lesson.content); 
      setEditClassDate(lesson.class_date || '');
      setEditStartTime(lesson.start_time ? lesson.start_time.substring(0, 5) : '');
      setEditEndTime(lesson.end_time ? lesson.end_time.substring(0, 5) : '');
    } else { setIsEditing(false); }

    const { data } = await supabase.from('messages').select('*').eq('lesson_id', lesson.id).order('created_at', { ascending: true });
    setMessages(data || []);

    markMessagesAsRead(lesson.id);
  }

  async function handleSaveLesson(e) {
    e.preventDefault();
    if (!selectedStudent) return;
    try {
      let duration_minutes = 0;
      if (editStartTime && editEndTime) {
        const start = new Date(`1970-01-01T${editStartTime}:00`);
        const end = new Date(`1970-01-01T${editEndTime}:00`);
        duration_minutes = Math.round((end - start) / 60000);
      }

      let refMonth = null;
      if (editClassDate) {
        const [year, month] = editClassDate.split('-');
        refMonth = `${year}-${month}`;
      } else {
        const now = new Date();
        refMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }

      const lessonData = { 
        title: editTitle || new Date().toLocaleDateString('pt-BR'), 
        content: editContent || '<p><br></p>', 
        student_id: selectedStudent.id,
        class_date: editClassDate || null,
        reference_month: refMonth, 
        start_time: editStartTime || null,
        end_time: editEndTime || null,
        duration_minutes: duration_minutes > 0 ? duration_minutes : 0,
        professor_checkin: true, 
        is_absent: false
      };

      if (isEditing) {
        const { data, error } = await supabase.from('lessons').update(lessonData).eq('id', selectedLesson.id).select();
        if (error) throw error;
        if (data && data[0]) { setLessons(lessons.map(l => l.id === selectedLesson.id ? data[0] : l)); selectLesson(data[0], 'view'); }
      } else {
        const { data, error } = await supabase.from('lessons').insert(lessonData).select();
        if (error) throw error;
        if (data && data[0]) { setLessons([data[0], ...lessons]); selectLesson(data[0], 'view'); } 
        else { fetchMyLessons(selectedStudent.id); setIsCreating(false); }
      }
    } catch (err) { console.error(err); alert("Erro ao salvar a aula."); }
  }

  async function handleFinishLesson() {
    if (!selectedLesson) return;
    try {
      const now = new Date();
      const end_time = now.toTimeString().split(' ')[0].substring(0, 5);
      
      let duration_minutes = selectedLesson.duration_minutes || 0;
      const startTime = selectedLesson.start_time;
      
      if (startTime) {
        const start = new Date(`1970-01-01T${startTime.substring(0, 5)}:00`);
        const end = new Date(`1970-01-01T${end_time}:00`);
        duration_minutes = Math.round((end - start) / 60000);
        if (duration_minutes < 0) duration_minutes = 0; 
      }
      
      const { data, error } = await supabase.from('lessons')
        .update({ 
          end_time, 
          duration_minutes,
          professor_checkin: true 
        })
        .eq('id', selectedLesson.id).select();
        
      if (error) throw error;
      
      if (data && data[0]) {
        setSelectedLesson(data[0]);
        setLessons(lessons.map(l => l.id === selectedLesson.id ? data[0] : l));
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao encerrar a aula.");
    }
  }

  async function handleStudentCheckin() {
    if (!selectedLesson) return;
    setIsCheckingIn(true);
    try {
      const { data, error } = await supabase.from('lessons')
        .update({ student_checkin: true })
        .eq('id', selectedLesson.id).select();
        
      if (error) throw error;

      if (!data || data.length === 0) {
        alert("Bloqueio de Segurança: O banco de dados não permitiu a ação (RLS). Execute o código SQL no Supabase para liberar.");
        return;
      }
      
      if (data && data[0]) {
        setSelectedLesson(data[0]);
        setLessons(lessons.map(l => l.id === selectedLesson.id ? data[0] : l));
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao confirmar presença.");
    } finally {
      setIsCheckingIn(false);
    }
  }

  async function handleDeleteLesson() {
    const { error } = await supabase.from('lessons').delete().eq('id', showDeleteModal);
    if (!error) {
      setLessons(lessons.filter(l => l.id !== showDeleteModal));
      if (selectedLesson?.id === showDeleteModal) setSelectedLesson(null);
      setShowDeleteModal(null);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    const msg = newMessage.trim();
    if (!msg || !session?.user || !selectedLesson) return;
    const { data, error } = await supabase.from('messages').insert({ lesson_id: selectedLesson.id, sender_id: session.user.id, content: msg }).select();
    if (!error) { setMessages((prev) => [...prev, data[0]]); setNewMessage(''); }
  }

  const handleLogin = async (e) => {
    e.preventDefault(); setLoadingLogin(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) alert(error.message);
    setLoadingLogin(false);
  }

  const modules = { toolbar: [[{ 'header': [1, 2, false] }], ['bold', 'italic', 'underline', 'strike'], [{'background': ['#deff9a', '#fde047', '#ffffff', 'transparent']}, {'color': []}], [{'list': 'ordered'}, {'list': 'bullet'}], ['clean']] };

  if (loading && session) return <div className={`min-h-screen ${isDarkMode ? 'theme-dark' : 'theme-light'} bg-[var(--bg-app)] flex items-center justify-center`}><Loader2 className="animate-spin w-10 h-10 text-[#5A77DF]" /></div>

  return (
    <div className={`min-h-screen w-full ${isDarkMode ? 'theme-dark' : 'theme-light'} bg-[var(--bg-app)] text-[var(--text-main)] font-sans transition-colors duration-500`} style={{ fontFamily: "'Inter', sans-serif" }}>
      
      {!session ? (
        <div className="flex h-screen w-full items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[var(--bg-card)] p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[var(--border-color)] text-center transition-colors duration-500">
            <div className="w-16 h-16 bg-[var(--icon-bg)] text-[var(--icon-color)] rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-sm"><BookOpen size={32} /></div>
            <h1 className="text-2xl font-bold text-[var(--text-main)] mb-2 tracking-tight">Welcome Back</h1>
            <p className="text-[var(--text-lighter)] text-sm mb-8">Sign in to access your journal</p>
            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div><label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest ml-4 mb-1 block">Email</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full px-6 py-4 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl text-[var(--text-main)] outline-none focus:border-[#5A77DF] transition-all text-base md:text-sm" required /></div>
              <div><label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest ml-4 mb-1 block">Password</label>
              <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full px-6 py-4 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl text-[var(--text-main)] outline-none focus:border-[#5A77DF] transition-all text-base md:text-sm" required /></div>
              <button type="submit" disabled={loadingLogin} className="w-full bg-[#5A77DF] text-white font-bold py-4 rounded-2xl hover:bg-[#4a63be] transition-all shadow-lg mt-6 disabled:opacity-50">{loadingLogin ? 'Signing in...' : 'Sign In'}</button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex h-screen w-full overflow-hidden relative">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden fixed top-5 left-5 z-40 bg-[var(--bg-sidebar)] text-white p-2.5 rounded-xl shadow-lg border border-white/10"><Menu size={20} /></button>
          {isMobileMenuOpen && <div onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden fixed inset-0 bg-[var(--modal-overlay)] backdrop-blur-sm z-40 animate-in fade-in" />}
          
          <aside className={`${isSidebarOpen ? 'lg:w-72' : 'lg:w-16'} ${isMobileMenuOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full lg:translate-x-0 w-0 lg:w-auto'} transition-all duration-300 ease-in-out fixed lg:relative inset-y-0 left-0 flex flex-col justify-between bg-[var(--bg-sidebar)] text-white z-50 border-r border-[var(--border-color)] shrink-0 shadow-2xl lg:shadow-none`}>
            {!isSidebarOpen && window.innerWidth >= 1024 ? (
              <div className="flex-1 flex flex-col items-center pt-8"><button onClick={() => setIsSidebarOpen(true)} className="text-white/60 hover:text-white transition-all mb-8 bg-white/5 p-2 rounded-xl"><PanelLeftOpen size={20} /></button>
              <div className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Menu</div></div>
            ) : (
              <div className={`flex flex-col flex-1 justify-between overflow-hidden ${!isMobileMenuOpen && window.innerWidth < 1024 ? 'opacity-0' : 'opacity-100'}`}>
                <div className="p-6 lg:p-8 flex-1 overflow-y-auto"><div className="flex items-center justify-between mb-10"><div className="flex items-center gap-3 font-bold text-xl whitespace-nowrap tracking-tight"><div className="bg-[#5A77DF] p-2 rounded-xl"><BookOpen size={20} className="text-white"/></div>Doug's Portal</div>
                <button onClick={() => setIsSidebarOpen(false)} className="hidden lg:block text-white/50 hover:text-white transition-colors ml-2"><PanelLeftClose size={20}/></button>
                <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-white/50 hover:text-white transition-colors bg-white/5 p-2 rounded-lg"><X size={18}/></button></div>
                <nav className="space-y-3">
                  {profile?.role === 'teacher' && <button onClick={() => {setCurrentView('dashboard'); setSelectedStudent(null); setSelectedLesson(null); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all font-semibold text-sm whitespace-nowrap ${currentView === 'dashboard' && !selectedStudent ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-md' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}><LayoutDashboard size={18}/> Dashboard</button>}
                  {profile?.role === 'teacher' && <button onClick={() => {setCurrentView('crm'); setSelectedLesson(null); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all font-semibold text-sm whitespace-nowrap ${currentView === 'crm' ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-md' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}><Users size={18}/> Student CRM</button>}
                  <button onClick={() => {setCurrentView('vocabulary'); setSelectedLesson(null); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all font-semibold text-sm whitespace-nowrap ${currentView === 'vocabulary' ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-md' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}><BookText size={18}/> Vocabulary</button>
                  {profile?.role === 'student' && <button onClick={() => {setCurrentView('journal'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all font-semibold text-sm whitespace-nowrap ${currentView === 'journal' ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-md' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}><BookOpen size={18}/> My Classes</button>}
                </nav></div>
                <div className="p-6 border-t border-white/10 shrink-0"><div className="flex flex-col gap-4"><div className="flex items-center gap-3 px-2"><div className="w-10 h-10 bg-[#5A77DF] rounded-full flex items-center justify-center font-bold text-white shadow-md shrink-0">{profile?.full_name?.charAt(0)}</div><div className="flex-1 overflow-hidden"><p className="text-sm font-bold tracking-tight text-white truncate">{profile?.full_name}</p><p className="text-[10px] text-white/50 truncate uppercase tracking-widest">{profile?.role}</p></div></div><div className="flex gap-2"><button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all flex items-center justify-center bg-white/5">{isDarkMode ? <Sun size={18} /> : <Moon size={18} />}</button><button onClick={() => supabase.auth.signOut()} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all text-xs font-bold uppercase tracking-widest whitespace-nowrap bg-white/5"><LogOut size={16}/> Sair</button></div></div></div>
              </div>
            )}
          </aside>

          <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-[var(--bg-app)]">
            {currentView === 'crm' && profile?.role === 'teacher' ? (
              <StudentCRM profile={profile} students={students} isDarkMode={isDarkMode} fetchStudents={fetchStudents} />
            ) : currentView === 'vocabulary' ? (
              <div className="flex-1 w-full h-full"><VocabularyDeck profile={profile} session={session} selectedStudent={selectedStudent} isDarkMode={isDarkMode} /></div>
            ) : (profile?.role === 'teacher' && !selectedStudent) || (profile?.role === 'student' && currentView === 'dashboard') ? (
              <div className="flex-1 overflow-y-auto p-6 md:p-10 lg:p-12 animate-in fade-in duration-500"><div className="max-w-5xl mx-auto w-full pt-16 lg:pt-0">
              
              {profile?.role === 'teacher' && <DashboardStats students={students} />}

              <header className="flex justify-between items-end mb-8"><div><h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-main)]">Your Students</h1><p className="text-[var(--text-muted)] text-sm mt-1">Select a student to manage their journal</p></div></header>
              <div className="flex flex-col gap-4">{students.map(s => (
                <div key={s.id} onClick={() => {setCurrentView('journal'); setSelectedStudent(s); fetchMyLessons(s.id); if(window.innerWidth < 1024) setIsLessonListOpen(true)}} className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-5 rounded-2xl hover:shadow-md cursor-pointer transition-all flex items-center justify-between group shadow-sm relative overflow-hidden">
                  <div className="flex items-center gap-4 md:gap-5"><div className="w-12 h-12 md:w-14 md:h-14 bg-[var(--icon-bg)] text-[var(--icon-color)] rounded-[1rem] flex items-center justify-center text-lg md:text-xl font-bold group-hover:bg-[#5A77DF] group-hover:text-white transition-all shadow-sm">{s.full_name?.charAt(0)}</div><div className="text-left"><h3 className="text-base md:text-lg font-bold text-[var(--text-main)] truncate max-w-[200px] md:max-w-sm tracking-tight">{s.full_name}</h3><p className="text-[var(--text-muted)] text-[10px] md:text-xs uppercase tracking-widest font-bold mt-1">Acessar Journal</p></div></div>
                  <div className="flex items-center gap-4 pr-2">{unreadByStudent[s.id] && <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse"></div>}<ChevronRight className="text-[var(--text-lighter)] group-hover:text-[#5A77DF] transition-colors" /></div>
                </div>
              ))}</div></div></div>
            ) : (
              <div className="flex flex-1 overflow-hidden bg-[var(--bg-card)] m-0 lg:m-4 rounded-none lg:rounded-[2rem] shadow-sm border-0 lg:border border-[var(--border-color)] flex-col relative">
                <div className="lg:hidden flex items-center justify-between px-4 h-20 border-b border-[var(--border-color)] shrink-0 pl-20 bg-[var(--bg-card)] relative z-30">
                  <button onClick={() => setIsLessonListOpen(true)} className="flex items-center gap-2 text-[var(--text-main)] font-semibold text-sm bg-[var(--bg-input)] py-2.5 px-4 rounded-xl border border-[var(--border-color)] shadow-sm">
                    <BookOpen size={16} className="text-[#5A77DF]" /> Menu Aulas
                  </button>
                  {selectedLesson && (
                    <button onClick={() => setIsMobileChatOpen(true)} className="relative bg-[#5A77DF] text-white p-3 rounded-xl shadow-md">
                      <MessageSquare size={18} />
                      {unreadByLesson[selectedLesson.id] && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[var(--bg-card)]"></div>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                  {isLessonListOpen && <div onClick={() => setIsLessonListOpen(false)} className="lg:hidden absolute inset-0 bg-[var(--modal-overlay)] backdrop-blur-sm z-30 animate-in fade-in" />}
                  <div className={`absolute lg:relative z-40 h-full top-0 left-0 lg:left-auto ${isLessonListOpen ? 'translate-x-0 w-[280px] lg:w-[320px]' : '-translate-x-full lg:translate-x-0 w-[280px] lg:w-16'} transition-transform duration-300 ease-in-out border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-card)] shrink-0`}>
                    {!isLessonListOpen && window.innerWidth >= 1024 ? (
                      <div className="flex-1 flex flex-col items-center pt-8"><button onClick={() => setIsLessonListOpen(true)} className="text-[var(--text-lighter)] hover:text-[#5A77DF] transition-all mb-8 bg-[var(--bg-input)] p-2 rounded-xl"><PanelRightOpen size={20} /></button><div className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold tracking-[0.2em] text-[var(--text-lighter)] uppercase">Aulas</div></div>
                    ) : (
                      <div className={`flex flex-col flex-1 h-full ${!isLessonListOpen && window.innerWidth < 1024 ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
                        <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between shrink-0 bg-[var(--bg-card)]"><div className="overflow-hidden">{profile?.role === 'teacher' && <button onClick={() => setSelectedStudent(null)} className="text-[10px] font-bold text-[var(--text-lighter)] hover:text-[#5A77DF] flex items-center gap-1 mb-2 tracking-widest transition-colors"><ArrowLeft size={12}/> DASHBOARD</button>}
                        <h3 className="text-lg font-bold text-[var(--text-main)] truncate tracking-tight">{profile?.role === 'teacher' ? selectedStudent?.full_name : 'My Journal'}</h3></div><button onClick={() => setIsLessonListOpen(false)} className="text-[var(--text-lighter)] hover:text-[var(--text-main)] transition-colors ml-2 shrink-0 bg-[var(--bg-input)] p-1.5 rounded-lg"><PanelRightClose size={18}/></button></div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--bg-app)]/30"><div className="flex justify-between items-center mb-6 px-2 mt-2"><span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Schedule</span>
                        {profile?.role === 'teacher' && <button onClick={() => { 
                          setIsCreating(true); 
                          setIsEditing(false); 
                          setEditTitle(''); 
                          setEditContent(''); 
                          const now = new Date();
                          setEditClassDate(now.toISOString().split('T')[0]);
                          setEditStartTime(now.toTimeString().split(' ')[0].substring(0,5));
                          setEditEndTime('');
                          if(window.innerWidth < 1024) setIsLessonListOpen(false); 
                        }} className="flex items-center gap-1 text-[#5A77DF] font-bold text-xs bg-[#5A77DF]/10 hover:bg-[#5A77DF]/20 px-2.5 py-1.5 rounded-lg transition-all border border-[#5A77DF]/20"><Plus size={14} /> Nova</button>}</div>
                        {lessons.map(l => (
                          <div key={l.id} className="group relative"><div onClick={() => selectLesson(l, 'view')} className={`p-4 rounded-2xl cursor-pointer transition-all relative ${selectedLesson?.id === l.id && !isEditing && !isCreating ? 'bg-[#5A77DF] text-white shadow-md' : 'bg-[var(--bg-card)] hover:bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] shadow-sm'}`}>
                          {unreadByLesson[l.id] && selectedLesson?.id !== l.id && <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full"></div>}
                          <p className={`text-sm font-semibold truncate ${profile?.role === 'teacher' ? 'pr-16 lg:pr-6' : ''} ${unreadByLesson[l.id] && selectedLesson?.id !== l.id ? 'pl-2' : ''}`}>{l.title}</p></div>
                          {profile?.role === 'teacher' && <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 flex gap-1 bg-[var(--bg-card)] shadow-md p-1 rounded-xl border border-[var(--border-color)] transition-all z-10"><button onClick={(e) => { e.stopPropagation(); selectLesson(l, 'edit'); if(window.innerWidth < 1024) setIsLessonListOpen(false); }} className="p-1.5 text-[var(--text-muted)] hover:text-[#5A77DF] hover:bg-[var(--bg-input)] rounded-lg"><Pencil size={14}/></button>
                          <button onClick={(e) => { e.stopPropagation(); setShowDeleteModal(l.id); }} className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 size={14}/></button></div>}</div>
                        ))}</div></div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col bg-[var(--bg-card)] relative overflow-hidden transition-all duration-300">
                    <div className="w-full h-full flex flex-col">
                      {(isCreating || isEditing) ? (
                        <form onSubmit={handleSaveLesson} className="flex-1 flex flex-col p-6 md:p-10 space-y-6 overflow-y-auto animate-in fade-in duration-300 relative z-10 pt-8 lg:pt-10"><div className="flex justify-between items-center bg-[var(--bg-input)] p-4 rounded-2xl border border-[var(--border-color)]"><span className="text-[10px] font-bold text-[#5A77DF] uppercase tracking-widest px-2 py-1 bg-[#5A77DF]/10 rounded-md">{isEditing ? 'Editing Lesson' : 'New Assignment'}</span><button type="button" onClick={() => {setIsCreating(false); setIsEditing(false)}} className="text-[var(--text-lighter)] hover:text-red-500 bg-[var(--bg-card)] p-1.5 rounded-lg shadow-sm border border-[var(--border-color)]"><X size={18}/></button></div>
                        <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="bg-transparent text-3xl md:text-4xl font-bold text-[var(--text-main)] outline-none border-b border-[var(--border-color)] pb-4 placeholder:text-[var(--text-lighter)] tracking-tight" placeholder="Lesson Title..." />
                        
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

                        <div className="flex-1 bg-[var(--bg-card)] rounded-[2rem] border border-[var(--border-color)] overflow-hidden shadow-sm flex flex-col min-h-[300px]"><ReactQuill theme="snow" value={editContent} onChange={setEditContent} modules={modules} className="h-full flex-1 flex flex-col editor-clean" /></div>
                        <div className="flex justify-end pt-2 pb-6 md:pb-0"><button type="submit" className="w-full md:w-auto bg-[#5A77DF] text-white font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#4a63be] transition-all shadow-lg active:scale-95 text-sm"><Save size={18}/> {isEditing ? 'Update Lesson' : 'Publish to Journal'}</button></div></form>
                      ) : selectedLesson ? (
                        <div className="flex flex-1 overflow-hidden relative">
                          <div className="flex-1 p-6 md:p-12 overflow-y-auto relative z-10 pt-8 lg:pt-12"><div className="max-w-4xl mx-auto pb-10">
                              
                              {/* BANNER DO PROFESSOR */}
                              {profile?.role === 'teacher' && !selectedLesson.end_time && (
                                <div className="mb-6 flex flex-wrap items-center justify-between gap-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 shadow-sm animate-in fade-in">
                                  <div className="flex-1 min-w-[200px]">
                                    <p className="text-emerald-500 font-bold text-sm tracking-tight flex items-center gap-2"><CheckCircle2 size={16} /> Aula em andamento</p>
                                    <p className="text-emerald-500/70 text-xs mt-1">Clique em finalizar para registrar o horário de saída no CRM.</p>
                                  </div>
                                  <button onClick={handleFinishLesson} className="shrink-0 w-full xl:w-auto bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:bg-emerald-600 transition-all active:scale-95 text-sm whitespace-nowrap text-center">
                                    Encerrar Aula
                                  </button>
                                </div>
                              )}

                              {profile?.role === 'teacher' && selectedLesson.end_time && (
                                <div className="mb-6 inline-flex items-center gap-2 bg-[#5A77DF]/10 border border-[#5A77DF]/20 px-3 py-1.5 rounded-lg animate-in fade-in">
                                  <Clock size={14} className="text-[#5A77DF]"/>
                                  <span className="text-[#5A77DF] font-bold text-xs">Encerrada às {selectedLesson.end_time.substring(0,5)} ({selectedLesson.duration_minutes} min)</span>
                                </div>
                              )}

                              {/* BANNER DO ALUNO */}
                              {profile?.role === 'student' && !selectedLesson.student_checkin && (
                                <div className="mb-6 flex flex-wrap items-center justify-between gap-4 bg-[#5A77DF]/10 border border-[#5A77DF]/20 rounded-2xl p-4 sm:p-5 shadow-sm animate-in fade-in">
                                  <div className="flex-1 min-w-[200px]">
                                    <p className="text-[#5A77DF] font-bold text-sm tracking-tight flex items-center gap-2"><CheckCircle2 size={16} /> Confirme sua presença</p>
                                    <p className="text-[#5A77DF]/70 text-xs mt-1">Registre sua entrada para atualizar o sistema do professor.</p>
                                  </div>
                                  <button 
                                    onClick={handleStudentCheckin} 
                                    disabled={isCheckingIn}
                                    className="shrink-0 w-full xl:w-auto flex items-center justify-center gap-2 bg-[#5A77DF] text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:bg-[#4a63be] transition-all active:scale-95 disabled:opacity-50 text-sm whitespace-nowrap text-center"
                                  >
                                    {isCheckingIn ? <Loader2 size={16} className="animate-spin" /> : null}
                                    {isCheckingIn ? 'Confirmando...' : 'Confirmar Presença'}
                                  </button>
                                </div>
                              )}

                              {/* FEEDBACK DE PRESENÇA CONFIRMADA */}
                              {profile?.role === 'student' && selectedLesson.student_checkin && (
                                <div className="mb-6 inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg animate-in fade-in">
                                  <CheckCircle2 size={14} className="text-emerald-500"/>
                                  <span className="text-emerald-500 font-bold text-xs">Presença confirmada. Boa aula!</span>
                                </div>
                              )}

                              <h2 className="text-3xl md:text-5xl font-bold text-[var(--text-main)] mb-8 md:mb-10 tracking-tight leading-tight">{selectedLesson.title}</h2>
                              
                              <div className="w-full min-h-[500px] h-[60vh] flex flex-col mb-8">
                                <CollaborativeEditor
                                  lessonId={selectedLesson.id}
                                  initialContent={selectedLesson?.content || ''}
                                  setContent={(html) => {
                                    setSelectedLesson(prev => ({ ...prev, content: html }));
                                    setLessons(prev => prev.map(l => l.id === selectedLesson.id ? { ...l, content: html } : l));
                                  }}
                                  modules={modules}
                                  profile={profile}
                                />
                              </div>
                              
                            </div>
                          </div>
                          {isMobileChatOpen && <div onClick={() => setIsMobileChatOpen(false)} className="lg:hidden absolute inset-0 bg-[var(--modal-overlay)] backdrop-blur-sm z-30 animate-in fade-in" />}
                          
                          {/* CHAT RETRÁTIL */}
                          <div className={`absolute lg:relative z-40 h-full right-0 ${isMobileChatOpen ? 'translate-x-0 w-full sm:w-[380px]' : 'translate-x-full lg:translate-x-0'} ${isChatOpen ? 'lg:w-[380px]' : 'lg:w-16'} transition-all duration-300 ease-in-out lg:border-l border-[var(--border-color)] flex flex-col bg-[var(--bg-chat)] shrink-0 shadow-2xl lg:shadow-none`}>
                            
                            {!isChatOpen && window.innerWidth >= 1024 ? (
                              <div className="flex-1 flex flex-col items-center pt-8">
                                <button onClick={() => setIsChatOpen(true)} className="relative text-[var(--text-lighter)] hover:text-[#5A77DF] transition-all mb-8 bg-[var(--bg-input)] p-2 rounded-xl shadow-sm border border-[var(--border-color)]">
                                  <MessageSquare size={20} />
                                  {unreadByLesson[selectedLesson.id] && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[var(--bg-chat)]"></div>}
                                </button>
                                <div className="[writing-mode:vertical-rl] text-[10px] font-bold tracking-[0.2em] text-[var(--text-lighter)] uppercase">Chat</div>
                              </div>
                            ) : (
                              <div className={`flex flex-col flex-1 h-full ${!isChatOpen && window.innerWidth >= 1024 ? 'opacity-0 hidden' : 'opacity-100'} transition-opacity duration-300`}>
                                <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card)] lg:bg-transparent shrink-0">
                                  <div className="flex items-center gap-3">
                                    <div className="bg-[var(--bg-card)] p-2 rounded-xl shadow-sm border border-[var(--border-color)] text-[#5A77DF]"><MessageSquare size={18}/></div>
                                    <h3 className="font-bold text-[var(--text-main)] text-sm tracking-tight">Class Discussion</h3>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => setIsChatOpen(false)} className="hidden lg:flex text-[var(--text-lighter)] hover:text-[var(--text-main)] transition-colors bg-[var(--bg-input)] p-1.5 rounded-lg border border-[var(--border-color)] shadow-sm"><PanelRightClose size={18}/></button>
                                    <button onClick={() => setIsMobileChatOpen(false)} className="lg:hidden text-[var(--text-lighter)] hover:text-red-500 bg-[var(--bg-input)] p-2 rounded-xl"><X size={18}/></button>
                                  </div>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-5 space-y-5 relative">
                                  {messages?.length === 0 && <div className="text-center text-[var(--text-lighter)] text-sm mt-10 italic px-4">No messages yet. Ask a question!</div>}
                                  {messages?.map(m => (
                                    <div key={m.id} className={`flex flex-col ${m.sender_id === session?.user.id ? 'items-end' : 'items-start'}`}><div className={`max-w-[88%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${m.sender_id === session?.user.id ? 'bg-[#5A77DF] text-white rounded-tr-sm font-semibold' : 'bg-[var(--msg-other)] border border-[var(--border-color)] text-[var(--text-main)] rounded-tl-sm'}`}>{m.content}</div></div>
                                  ))}
                                  <div ref={messagesEndRef} className="h-1" />
                                </div>

                                <form onSubmit={sendMessage} className="p-4 bg-[var(--bg-card)] border-t border-[var(--border-color)] pb-8 lg:pb-4">
                                  <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-full p-1 pl-4 focus-within:border-[#5A77DF] focus-within:bg-[var(--bg-card)] transition-all shadow-inner">
                                    <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 bg-transparent text-base md:text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-lighter)]" />
                                    <button type="submit" disabled={!newMessage.trim()} className="w-10 h-10 bg-[#5A77DF] text-white rounded-full flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50 flex-shrink-0"><Send size={16}/></button>
                                  </div>
                                </form>
                              </div>
                            )}
                          </div>

                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-lighter)] bg-[var(--bg-app)]/30 p-6 text-center"><div className="w-20 h-20 md:w-24 md:h-24 bg-[var(--bg-card)] rounded-3xl shadow-sm border border-[var(--border-color)] flex items-center justify-center mb-6"><BookOpen size={40} className="opacity-40" /></div><p className="font-bold text-sm tracking-tight mb-6">Welcome to Elite Journal. <br/> Select a lesson to start studying.</p><button onClick={() => setIsLessonListOpen(true)} className="lg:hidden bg-[#5A77DF] text-white px-6 py-3 rounded-xl font-bold shadow-md active:scale-95 transition-all">Menu Aulas</button></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-[var(--modal-overlay)] backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in"><div className="bg-[var(--bg-card)] p-8 md:p-10 rounded-[2rem] max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 border border-[var(--border-color)]"><div className="w-16 h-16 md:w-20 md:h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle size={30} /></div><h3 className="text-xl font-bold text-[var(--text-main)] mb-2 tracking-tight">Delete this lesson?</h3><p className="text-[var(--text-muted)] text-sm mb-8 leading-relaxed">This action cannot be undone.</p><div className="flex flex-col gap-3"><button onClick={handleDeleteLesson} className="w-full bg-red-500 text-white font-bold py-4 rounded-xl hover:bg-red-600 shadow-md shadow-red-500/20 text-sm uppercase">Delete</button><button onClick={() => setShowDeleteModal(null)} className="w-full bg-[var(--bg-input)] text-[var(--text-main)] font-bold py-4 rounded-xl border border-[var(--border-color)] text-sm uppercase">Cancel</button></div></div></div>
      )}

      <style>{`
        .theme-light { --bg-app: #ECEEF0; --bg-sidebar: #323954; --bg-card: #ffffff; --bg-chat: #F8FAFC; --bg-input: #f9fafb; --border-color: #f3f4f6; --text-main: #08112F; --text-muted: #6b7280; --text-lighter: #9ca3af; --icon-bg: #F3F6FF; --icon-color: #5A77DF; --msg-other: #ffffff; --modal-overlay: rgba(8, 17, 47, 0.4); }
        .theme-dark { --bg-app: #202124; --bg-sidebar: #171717; --bg-card: #292A2D; --bg-chat: #202124; --bg-input: #303134; --border-color: #3C4043; --text-main: #E8EAED; --text-muted: #9AA0A6; --text-lighter: #80868B; --icon-bg: rgba(90, 119, 223, 0.1); --icon-color: #8AB4F8; --msg-other: #303134; --modal-overlay: rgba(0, 0, 0, 0.75); }
        .editor-clean .ql-container { border: none !important; font-family: 'Inter', sans-serif; }
        .editor-clean .ql-toolbar { background: var(--bg-chat); border: none !important; border-bottom: 1px solid var(--border-color) !important; padding: 10px md:16px !important; border-top-left-radius: 1.5rem; border-top-right-radius: 1.5rem; overflow-x: auto; white-space: nowrap; }
        .editor-clean .ql-editor { min-height: 250px; color: var(--text-main); padding: 20px; line-height: 1.7; font-size: 1rem; }
        @media (min-width: 768px) { .editor-clean .ql-editor { padding: 32px; font-size: 1.1rem; } }
        .editor-clean .ql-editor.ql-blank::before { color: var(--text-lighter); font-style: normal; left: 20px; }
        @media (min-width: 768px) { .editor-clean .ql-editor.ql-blank::before { left: 32px; } }
        .editor-clean .ql-stroke { stroke: var(--text-muted) !important; }
        .editor-clean .ql-fill { fill: var(--text-muted) !important; }
        .editor-clean .ql-picker { color: var(--text-muted) !important; }
        .custom-render h1 { font-size: 2rem; color: var(--text-main); margin-bottom: 1rem; font-weight: 800; tracking: -0.02em; }
        @media (min-width: 768px) { .custom-render h1 { font-size: 2.5rem; margin-bottom: 1.5rem; } }
        .custom-render h2 { font-size: 1.5rem; color: var(--text-main); margin-bottom: 0.8rem; font-weight: 700; }
        @media (min-width: 768px) { .custom-render h2 { font-size: 1.8rem; } }
        .custom-render p { margin-bottom: 1rem; color: var(--text-main); }
        @media (min-width: 768px) { .custom-render p { margin-bottom: 1.2rem; } }
        .custom-render strong { color: var(--text-main); font-weight: 700; }
        .custom-render ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1.5rem; color: var(--text-main); }
        .custom-render ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1.5rem; color: var(--text-main); }
        .custom-render span[style*="background-color: rgb(222, 255, 154)"] { color: #08112F !important; font-weight: bold; padding: 0 4px; border-radius: 4px; }
        .custom-render span[style*="background-color: rgb(253, 224, 71)"] { color: #08112F !important; font-weight: bold; padding: 0 4px; border-radius: 4px; }
      `}</style>
      <AlertModal />
    </div>
  )
}

export default App