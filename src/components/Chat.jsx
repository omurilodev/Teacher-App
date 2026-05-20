import { useRef, useEffect } from 'react'
import { Send, X, PanelRightClose, MessageSquare } from 'lucide-react'

export default function Chat({
  isChatOpen, setIsChatOpen,
  isMobileChatOpen, setIsMobileChatOpen,
  selectedLesson, unreadByLesson,
  messages, newMessage, setNewMessage,
  session, sendMessage,
}) {
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isMobileChatOpen, isChatOpen])

  return (
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
              <div className="bg-[var(--bg-card)] p-2 rounded-xl shadow-sm border border-[var(--border-color)] text-[#5A77DF]"><MessageSquare size={18} /></div>
              <h3 className="font-bold text-[var(--text-main)] text-sm tracking-tight">Class Discussion</h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsChatOpen(false)} className="hidden lg:flex text-[var(--text-lighter)] hover:text-[var(--text-main)] transition-colors bg-[var(--bg-input)] p-1.5 rounded-lg border border-[var(--border-color)] shadow-sm"><PanelRightClose size={18} /></button>
              <button onClick={() => setIsMobileChatOpen(false)} className="lg:hidden text-[var(--text-lighter)] hover:text-red-500 bg-[var(--bg-input)] p-2 rounded-xl"><X size={18} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5 relative">
            {messages?.length === 0 && (
              <div className="text-center text-[var(--text-lighter)] text-sm mt-10 italic px-4">No messages yet. Ask a question!</div>
            )}
            {messages?.map(m => (
              <div key={m.id} className={`flex flex-col ${m.sender_id === session?.user.id ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[88%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${m.sender_id === session?.user.id ? 'bg-[#5A77DF] text-white rounded-tr-sm font-semibold' : 'bg-[var(--msg-other)] border border-[var(--border-color)] text-[var(--text-main)] rounded-tl-sm'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} className="h-1" />
          </div>

          <form onSubmit={sendMessage} className="p-4 bg-[var(--bg-card)] border-t border-[var(--border-color)] pb-8 lg:pb-4">
            <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-full p-1 pl-4 focus-within:border-[#5A77DF] focus-within:bg-[var(--bg-card)] transition-all shadow-inner">
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 bg-transparent text-base md:text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-lighter)]" />
              <button type="submit" disabled={!newMessage.trim()} className="w-10 h-10 bg-[#5A77DF] text-white rounded-full flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50 flex-shrink-0"><Send size={16} /></button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
