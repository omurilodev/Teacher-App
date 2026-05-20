import { BookOpen } from 'lucide-react'

export default function LoginPage({ loginEmail, setLoginEmail, loginPassword, setLoginPassword, loadingLogin, handleLogin }) {
  return (
    <div className="flex h-screen w-full items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[var(--bg-card)] p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[var(--border-color)] text-center transition-colors duration-500">
        <div className="w-16 h-16 bg-[var(--icon-bg)] text-[var(--icon-color)] rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-sm"><BookOpen size={32} /></div>
        <h1 className="text-2xl font-bold text-[var(--text-main)] mb-2 tracking-tight">Welcome Back</h1>
        <p className="text-[var(--text-lighter)] text-sm mb-8">Sign in to access your journal</p>
        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest ml-4 mb-1 block">Email</label>
            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full px-6 py-4 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl text-[var(--text-main)] outline-none focus:border-[#5A77DF] transition-all text-base md:text-sm" required />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest ml-4 mb-1 block">Password</label>
            <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full px-6 py-4 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl text-[var(--text-main)] outline-none focus:border-[#5A77DF] transition-all text-base md:text-sm" required />
          </div>
          <button type="submit" disabled={loadingLogin} className="w-full bg-[#5A77DF] text-white font-bold py-4 rounded-2xl hover:bg-[#4a63be] transition-all shadow-lg mt-6 disabled:opacity-50">
            {loadingLogin ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
