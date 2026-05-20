import { supabase } from '../supabase'
import {
  BookOpen, LogOut, LayoutDashboard,
  X, PanelLeftClose, PanelLeftOpen,
  Sun, Moon, BookText, Users, CalendarDays, Receipt,
} from 'lucide-react'

export default function Sidebar({
  isSidebarOpen, setIsSidebarOpen,
  isMobileMenuOpen, setIsMobileMenuOpen,
  profile, currentView, setCurrentView,
  setSelectedStudent, setSelectedLesson,
  isDarkMode, setIsDarkMode,
  selectedStudent,
}) {
  return (
    <aside className={`${isSidebarOpen ? 'lg:w-72' : 'lg:w-16'} ${isMobileMenuOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full lg:translate-x-0 w-0 lg:w-auto'} transition-all duration-300 ease-in-out fixed lg:relative inset-y-0 left-0 flex flex-col justify-between bg-[var(--bg-sidebar)] text-white z-50 border-r border-[var(--border-color)] shrink-0 shadow-2xl lg:shadow-none`}>
      {!isSidebarOpen && window.innerWidth >= 1024 ? (
        <div className="flex-1 flex flex-col items-center pt-8">
          <button onClick={() => setIsSidebarOpen(true)} className="text-white/60 hover:text-white transition-all mb-8 bg-white/5 p-2 rounded-xl"><PanelLeftOpen size={20} /></button>
          <div className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Menu</div>
        </div>
      ) : (
        <div className={`flex flex-col flex-1 justify-between overflow-hidden ${!isMobileMenuOpen && window.innerWidth < 1024 ? 'opacity-0' : 'opacity-100'}`}>
          <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3 font-bold text-xl whitespace-nowrap tracking-tight">
                <div className="bg-[#5A77DF] p-2 rounded-xl"><BookOpen size={20} className="text-white" /></div>Doug's Portal
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="hidden lg:block text-white/50 hover:text-white transition-colors ml-2"><PanelLeftClose size={20} /></button>
              <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-white/50 hover:text-white transition-colors bg-white/5 p-2 rounded-lg"><X size={18} /></button>
            </div>
            <nav className="space-y-3">
              {profile?.role === 'teacher' && (
                <button
                  onClick={() => { setCurrentView('dashboard'); setSelectedStudent(null); setSelectedLesson(null); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all font-semibold text-sm whitespace-nowrap ${currentView === 'dashboard' && !selectedStudent ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-md' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                ><LayoutDashboard size={18} /> Dashboard</button>
              )}
              {profile?.role === 'teacher' && (
                <button
                  onClick={() => { setCurrentView('schedule'); setSelectedLesson(null); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all font-semibold text-sm whitespace-nowrap ${currentView === 'schedule' ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-md' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                ><CalendarDays size={18} /> Agenda</button>
              )}
              {profile?.role === 'teacher' && (
                <button
                  onClick={() => { setCurrentView('crm'); setSelectedLesson(null); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all font-semibold text-sm whitespace-nowrap ${currentView === 'crm' ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-md' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                ><Users size={18} /> Student CRM</button>
              )}
              <button
                onClick={() => { setCurrentView('vocabulary'); setSelectedLesson(null); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all font-semibold text-sm whitespace-nowrap ${currentView === 'vocabulary' ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-md' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
              ><BookText size={18} /> Vocabulary</button>
              {profile?.role === 'student' && (
                <button
                  onClick={() => { setCurrentView('journal'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all font-semibold text-sm whitespace-nowrap ${currentView === 'journal' ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-md' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                ><BookOpen size={18} /> My Classes</button>
              )}
              {profile?.role === 'student' && (
                <button
                  onClick={() => { setCurrentView('receipts'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all font-semibold text-sm whitespace-nowrap ${currentView === 'receipts' ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-md' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                ><Receipt size={18} /> Comprovantes</button>
              )}
            </nav>
          </div>
          <div className="p-6 border-t border-white/10 shrink-0">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-10 h-10 bg-[#5A77DF] rounded-full flex items-center justify-center font-bold text-white shadow-md shrink-0">{profile?.full_name?.charAt(0)}</div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-bold tracking-tight text-white truncate">{profile?.full_name}</p>
                  <p className="text-[10px] text-white/50 truncate uppercase tracking-widest">{profile?.role}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all flex items-center justify-center bg-white/5">
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button onClick={() => supabase.auth.signOut()} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all text-xs font-bold uppercase tracking-widest whitespace-nowrap bg-white/5">
                  <LogOut size={16} /> Sair
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
