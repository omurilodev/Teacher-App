import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import StudentCRM from './components/StudentCRM'
import VocabularyDeck from './components/VocabularyDeck'
import {
  BookOpen, Loader2, Menu, MessageSquare,
  ChevronRight, AlertTriangle,
} from 'lucide-react'
import DashboardStats from './components/DashboardStats'
import AlertModal from './components/AlertModal'
import LoginPage from './components/LoginPage'
import Sidebar from './components/Sidebar'
import LessonList from './components/LessonList'
import LessonForm from './components/LessonForm'
import LessonView from './components/LessonView'
import WeeklySchedule from './components/WeeklySchedule'
import { useAuth } from './hooks/useAuth'
import { useMessages } from './hooks/useMessages'
import { useLessons } from './hooks/useLessons'

const modules = { toolbar: [[{ 'header': [1, 2, false] }], ['bold', 'italic', 'underline', 'strike'], [{ 'background': ['#deff9a', '#fde047', '#ffffff', 'transparent'] }, { 'color': [] }], [{ 'list': 'ordered' }, { 'list': 'bullet' }], ['clean']] }

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isLessonListOpen, setIsLessonListOpen] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [currentView, setCurrentView] = useState('dashboard')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [selectedLesson, setSelectedLesson] = useState(null)

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('theme') === 'dark'
    return false
  })

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  const fetchUnreadStatusRef = useRef(null)
  const selectLessonRef = useRef(null)

  const {
    session, profile, students, lessons, setLessons,
    loading, loginEmail, setLoginEmail, loginPassword, setLoginPassword,
    loadingLogin, handleLogin, fetchStudents, fetchMyLessons,
  } = useAuth({ fetchUnreadStatusRef, setCurrentView })

  const {
    messages, setMessages, newMessage, setNewMessage,
    unreadByStudent, unreadByLesson,
    fetchUnreadStatus, markMessagesAsRead, sendMessage,
  } = useMessages({ profile, session, selectedLesson, isMobileChatOpen, isChatOpen })

  useEffect(() => { fetchUnreadStatusRef.current = fetchUnreadStatus }, [fetchUnreadStatus])

  const {
    isCreating, setIsCreating,
    isEditing, setIsEditing,
    showDeleteModal, setShowDeleteModal,
    isCheckingIn,
    editTitle, setEditTitle,
    editContent, setEditContent,
    editClassDate, setEditClassDate,
    editStartTime, setEditStartTime,
    editEndTime, setEditEndTime,
    editIsMakeup, setEditIsMakeup,
    editLateNotice, setEditLateNotice,
    editExtraFeePaid, setEditExtraFeePaid,
    handleSaveLesson, handleFinishLesson, handleDeleteLesson, handleStudentCheckin, handleNewLesson,
  } = useLessons({ selectedStudent, selectedLesson, setSelectedLesson, lessons, setLessons, fetchMyLessons, selectLessonRef })

  useEffect(() => {
    if ((isMobileChatOpen || isChatOpen) && selectedLesson) {
      markMessagesAsRead(selectedLesson.id)
    }
  }, [isMobileChatOpen, isChatOpen, selectedLesson, markMessagesAsRead])

  const selectLesson = useCallback(async (lesson, mode = 'view') => {
    if (!lesson || !lesson.id) return

    setIsMobileMenuOpen(false)
    if (window.innerWidth < 1024) setIsLessonListOpen(false)

    setIsCreating(false)
    setMessages([])
    setSelectedLesson(lesson)

    if (mode === 'edit') {
      setIsEditing(true)
      setEditTitle(lesson.title)
      setEditContent(lesson.content)
      setEditClassDate(lesson.class_date || '')
      setEditStartTime(lesson.start_time ? lesson.start_time.substring(0, 5) : '')
      setEditEndTime(lesson.end_time ? lesson.end_time.substring(0, 5) : '')
      setEditIsMakeup(lesson.is_makeup || false)
      setEditLateNotice(lesson.late_notice || false)
      setEditExtraFeePaid(lesson.extra_fee_paid || false)
    } else {
      setIsEditing(false)
    }

    const { data } = await supabase.from('messages').select('*').eq('lesson_id', lesson.id).order('created_at', { ascending: true })
    setMessages(data || [])

    markMessagesAsRead(lesson.id)
  }, [setIsCreating, setMessages, setIsEditing, setEditTitle, setEditContent, setEditClassDate, setEditStartTime, setEditEndTime, setEditIsMakeup, setEditLateNotice, setEditExtraFeePaid, markMessagesAsRead])

  useEffect(() => { selectLessonRef.current = selectLesson }, [selectLesson])

  if (loading && session) return (
    <div className={`min-h-screen ${isDarkMode ? 'theme-dark' : 'theme-light'} bg-[var(--bg-app)] flex items-center justify-center`}>
      <Loader2 className="animate-spin w-10 h-10 text-[#5A77DF]" />
    </div>
  )

  return (
    <div className={`min-h-screen w-full ${isDarkMode ? 'theme-dark' : 'theme-light'} bg-[var(--bg-app)] text-[var(--text-main)] font-sans transition-colors duration-500`} style={{ fontFamily: "'Inter', sans-serif" }}>

      {!session ? (
        <LoginPage
          loginEmail={loginEmail} setLoginEmail={setLoginEmail}
          loginPassword={loginPassword} setLoginPassword={setLoginPassword}
          loadingLogin={loadingLogin} handleLogin={handleLogin}
        />
      ) : (
        <div className="flex h-screen w-full overflow-hidden relative">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden fixed top-5 left-5 z-40 bg-[var(--bg-sidebar)] text-white p-2.5 rounded-xl shadow-lg border border-white/10"><Menu size={20} /></button>
          {isMobileMenuOpen && <div onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden fixed inset-0 bg-[var(--modal-overlay)] backdrop-blur-sm z-40 animate-in fade-in" />}

          <Sidebar
            isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}
            isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen}
            profile={profile} currentView={currentView} setCurrentView={setCurrentView}
            setSelectedStudent={setSelectedStudent} setSelectedLesson={setSelectedLesson}
            isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}
            selectedStudent={selectedStudent}
          />

          <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-[var(--bg-app)]">
            {currentView === 'crm' && profile?.role === 'teacher' ? (
              <StudentCRM profile={profile} students={students} isDarkMode={isDarkMode} fetchStudents={fetchStudents} />
            ) : currentView === 'vocabulary' ? (
              <div className="flex-1 w-full h-full"><VocabularyDeck profile={profile} session={session} selectedStudent={selectedStudent} isDarkMode={isDarkMode} /></div>
            ) : currentView === 'schedule' && profile?.role === 'teacher' ? (
              <div className="flex-1 overflow-y-auto p-6 md:p-10 lg:p-12 animate-in fade-in duration-500">
                <div className="max-w-5xl mx-auto w-full pt-16 lg:pt-0">
                  <WeeklySchedule students={students} isDarkMode={isDarkMode} />
                </div>
              </div>
            ) : (profile?.role === 'teacher' && !selectedStudent) || (profile?.role === 'student' && currentView === 'dashboard') ? (
              <div className="flex-1 overflow-y-auto p-6 md:p-10 lg:p-12 animate-in fade-in duration-500">
                <div className="max-w-5xl mx-auto w-full pt-16 lg:pt-0">
                  {profile?.role === 'teacher' && <DashboardStats students={students} />}
                  {profile?.role === 'teacher' && (
                    <div className="mb-10">
                      <WeeklySchedule students={students} isDarkMode={isDarkMode} />
                    </div>
                  )}
                  <header className="flex justify-between items-end mb-8">
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-main)]">Your Students</h1>
                      <p className="text-[var(--text-muted)] text-sm mt-1">Select a student to manage their journal</p>
                    </div>
                  </header>
                  <div className="flex flex-col gap-4">
                    {(() => {
                      const sorted = [...students].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'pt-BR'))
                      let lastLetter = null
                      const items = []
                      sorted.forEach(s => {
                        const letter = s.full_name?.charAt(0).toUpperCase() || '#'
                        if (letter !== lastLetter) {
                          lastLetter = letter
                          items.push(<div key={`sep-${letter}`} className="px-2 py-1 text-xs font-bold tracking-widest text-[var(--text-lighter)] uppercase">{letter}</div>)
                        }
                        items.push(
                          <div key={s.id} onClick={() => { setCurrentView('journal'); setSelectedStudent(s); fetchMyLessons(s.id); if (window.innerWidth < 1024) setIsLessonListOpen(true); }} className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-5 rounded-2xl hover:shadow-md cursor-pointer transition-all flex items-center justify-between group shadow-sm relative overflow-hidden">
                            <div className="flex items-center gap-4 md:gap-5">
                              <div className="w-12 h-12 md:w-14 md:h-14 bg-[var(--icon-bg)] text-[var(--icon-color)] rounded-[1rem] flex items-center justify-center text-lg md:text-xl font-bold group-hover:bg-[#5A77DF] group-hover:text-white transition-all shadow-sm">{s.full_name?.charAt(0)}</div>
                              <div className="text-left">
                                <h3 className="text-base md:text-lg font-bold text-[var(--text-main)] truncate max-w-[200px] md:max-w-sm tracking-tight">{s.full_name}</h3>
                                <p className="text-[var(--text-muted)] text-[10px] md:text-xs uppercase tracking-widest font-bold mt-1">Acessar Journal</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 pr-2">
                              {unreadByStudent[s.id] && <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse"></div>}
                              <ChevronRight className="text-[var(--text-lighter)] group-hover:text-[#5A77DF] transition-colors" />
                            </div>
                          </div>
                        )
                      })
                      return items
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 overflow-hidden bg-[var(--bg-card)] m-0 lg:m-4 rounded-none lg:rounded-[2rem] shadow-sm border-0 lg:border border-[var(--border-color)] flex-col relative">
                <div className="lg:hidden flex items-center justify-between px-4 h-20 border-b border-[var(--border-color)] shrink-0 pl-20 bg-[var(--bg-card)] relative z-30">
                  <button onClick={() => setIsLessonListOpen(true)} className="flex items-center gap-2 text-[var(--text-main)] font-semibold text-sm bg-[var(--bg-input)] py-2.5 px-4 rounded-xl border border-[var(--border-color)] shadow-sm">
                    <BookOpen size={16} className="text-[#5A77DF]" /> Menu Aulas
                  </button>
                  {selectedLesson && (
                    <button onClick={() => setIsMobileChatOpen(true)} className="relative bg-[#5A77DF] text-white p-3 rounded-xl shadow-md">
                      <MessageSquare size={18} />
                      {unreadByLesson[selectedLesson.id] && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[var(--bg-card)]"></div>}
                    </button>
                  )}
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                  {isLessonListOpen && <div onClick={() => setIsLessonListOpen(false)} className="lg:hidden absolute inset-0 bg-[var(--modal-overlay)] backdrop-blur-sm z-30 animate-in fade-in" />}

                  <LessonList
                    profile={profile}
                    selectedStudent={selectedStudent}
                    setSelectedStudent={setSelectedStudent}
                    lessons={lessons}
                    selectedLesson={selectedLesson}
                    isLessonListOpen={isLessonListOpen}
                    setIsLessonListOpen={setIsLessonListOpen}
                    unreadByLesson={unreadByLesson}
                    isEditing={isEditing}
                    isCreating={isCreating}
                    selectLesson={selectLesson}
                    setShowDeleteModal={setShowDeleteModal}
                    handleNewLesson={handleNewLesson}
                  />

                  <div className="flex-1 flex flex-col bg-[var(--bg-card)] relative overflow-hidden transition-all duration-300">
                    <div className="w-full h-full flex flex-col">
                      {(isCreating || isEditing) ? (
                        <LessonForm
                          isEditing={isEditing}
                          editTitle={editTitle} setEditTitle={setEditTitle}
                          editContent={editContent} setEditContent={setEditContent}
                          editClassDate={editClassDate} setEditClassDate={setEditClassDate}
                          editStartTime={editStartTime} setEditStartTime={setEditStartTime}
                          editEndTime={editEndTime} setEditEndTime={setEditEndTime}
                          editIsMakeup={editIsMakeup} setEditIsMakeup={setEditIsMakeup}
                          editLateNotice={editLateNotice} setEditLateNotice={setEditLateNotice}
                          editExtraFeePaid={editExtraFeePaid} setEditExtraFeePaid={setEditExtraFeePaid}
                          handleSaveLesson={handleSaveLesson}
                          setIsCreating={setIsCreating} setIsEditing={setIsEditing}
                          modules={modules}
                        />
                      ) : selectedLesson ? (
                        <LessonView
                          selectedLesson={selectedLesson} setSelectedLesson={setSelectedLesson}
                          lessons={lessons} setLessons={setLessons}
                          profile={profile}
                          isMobileChatOpen={isMobileChatOpen} setIsMobileChatOpen={setIsMobileChatOpen}
                          isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen}
                          unreadByLesson={unreadByLesson}
                          messages={messages} newMessage={newMessage} setNewMessage={setNewMessage}
                          session={session} sendMessage={sendMessage}
                          handleFinishLesson={handleFinishLesson}
                          handleStudentCheckin={handleStudentCheckin}
                          isCheckingIn={isCheckingIn}
                          modules={modules}
                        />
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--text-lighter)]">
                          <div className="w-20 h-20 md:w-24 md:h-24 bg-[var(--bg-card)] rounded-3xl shadow-sm border border-[var(--border-color)] flex items-center justify-center mb-6"><BookOpen size={40} className="opacity-40" /></div>
                          <p className="font-bold text-sm tracking-tight mb-6">Welcome to Elite Journal. <br /> Select a lesson to start studying.</p>
                          <button onClick={() => setIsLessonListOpen(true)} className="lg:hidden bg-[#5A77DF] text-white px-6 py-3 rounded-xl font-bold shadow-md active:scale-95 transition-all">Menu Aulas</button>
                        </div>
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
        <div className="fixed inset-0 bg-[var(--modal-overlay)] backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[var(--bg-card)] p-8 md:p-10 rounded-[2rem] max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 border border-[var(--border-color)]">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle size={30} /></div>
            <h3 className="text-xl font-bold text-[var(--text-main)] mb-2 tracking-tight">Delete this lesson?</h3>
            <p className="text-[var(--text-muted)] text-sm mb-8 leading-relaxed">This action cannot be undone.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleDeleteLesson} className="w-full bg-red-500 text-white font-bold py-4 rounded-xl hover:bg-red-600 shadow-md shadow-red-500/20 text-sm uppercase">Delete</button>
              <button onClick={() => setShowDeleteModal(null)} className="w-full bg-[var(--bg-input)] text-[var(--text-main)] font-bold py-4 rounded-xl border border-[var(--border-color)] text-sm uppercase">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .theme-light { --bg-app: #ECEEF0; --bg-sidebar: #323954; --bg-card: #ffffff; --bg-chat: #F8FAFC; --bg-input: #f9fafb; --border-color: #f3f4f6; --text-main: #08112F; --text-muted: #6b7280; --text-lighter: #9ca3af; --icon-bg: #F3F6FF; --icon-color: #5A77DF; --msg-other: #ffffff; --modal-overlay: rgba(8, 17, 47, 0.4); }
        .theme-dark { --bg-app: #202124; --bg-sidebar: #171717; --bg-card: #292A2D; --bg-chat: #202124; --bg-input: #303134; --border-color: #3C4043; --text-main: #E8EAED; --text-muted: #9AA0A6; --text-lighter: #80868B; --icon-bg: rgba(90, 119, 223, 0.1); --icon-color: #8AB4F8; --msg-other: #303134; --modal-overlay: rgba(0, 0, 0, 0.75); }
        .editor-clean .ql-container { border: none !important; font-family: 'Inter', sans-serif; }
        .editor-clean .ql-toolbar { background: var(--bg-chat); border: none !important; border-bottom: 1px solid var(--border-color) !important; padding: 10px md:16px !important; border-top-left-radius: 1.5rem; border-top-right-radius: 1.5rem; position: relative; z-index: 50; }
        .editor-clean .ql-picker-options { z-index: 100 !important; }
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
