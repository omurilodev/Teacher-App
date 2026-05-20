import { Loader2, CheckCircle2, Clock } from 'lucide-react'
import CollaborativeEditor from './CollaborativeEditor'
import Chat from './Chat'

export default function LessonView({
  selectedLesson, setSelectedLesson, lessons, setLessons,
  profile, isMobileChatOpen, setIsMobileChatOpen,
  isChatOpen, setIsChatOpen, unreadByLesson,
  messages, newMessage, setNewMessage,
  session, sendMessage,
  handleFinishLesson, handleStudentCheckin, isCheckingIn,
  modules,
}) {
  return (
    <div className="flex flex-1 overflow-hidden relative">
      <div className="flex-1 p-6 md:p-12 overflow-y-auto relative z-10 pt-8 lg:pt-12">
        <div className="max-w-4xl mx-auto pb-10">

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
              <Clock size={14} className="text-[#5A77DF]" />
              <span className="text-[#5A77DF] font-bold text-xs">Encerrada às {selectedLesson.end_time.substring(0, 5)} ({selectedLesson.duration_minutes} min)</span>
            </div>
          )}

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

          {profile?.role === 'student' && selectedLesson.student_checkin && (
            <div className="mb-6 inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg animate-in fade-in">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span className="text-emerald-500 font-bold text-xs">Presença confirmada. Boa aula!</span>
            </div>
          )}

          <h2 className="text-3xl md:text-5xl font-bold text-[var(--text-main)] mb-8 md:mb-10 tracking-tight leading-tight">{selectedLesson.title}</h2>

          <div className="w-full min-h-[500px] h-[60vh] flex flex-col mb-8">
            <CollaborativeEditor
              lessonId={selectedLesson.id}
              initialContent={selectedLesson?.content || ''}
              setContent={(html) => {
                setSelectedLesson(prev => ({ ...prev, content: html }))
                setLessons(prev => prev.map(l => l.id === selectedLesson.id ? { ...l, content: html } : l))
              }}
              modules={modules}
              profile={profile}
            />
          </div>

        </div>
      </div>

      {isMobileChatOpen && (
        <div onClick={() => setIsMobileChatOpen(false)} className="lg:hidden absolute inset-0 bg-[var(--modal-overlay)] backdrop-blur-sm z-30 animate-in fade-in" />
      )}

      <Chat
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        isMobileChatOpen={isMobileChatOpen}
        setIsMobileChatOpen={setIsMobileChatOpen}
        selectedLesson={selectedLesson}
        unreadByLesson={unreadByLesson}
        messages={messages}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        session={session}
        sendMessage={sendMessage}
      />
    </div>
  )
}
