import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase'
import { showAlert } from '../components/AlertModal'

export function useAuth({ fetchUnreadStatusRef, setCurrentView }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [students, setStudents] = useState([])
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loadingLogin, setLoadingLogin] = useState(false)

  const fetchStudents = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'student')
    setStudents(data || [])
  }, [])

  const fetchMyLessons = useCallback(async (uid) => {
    const { data } = await supabase.from('lessons').select('*').eq('student_id', uid).order('created_at', { ascending: false })
    setLessons(data || [])
  }, [])

  const fetchProfile = useCallback(async (uid, isInitialLogin = false) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data)

    if (data?.role === 'teacher') fetchStudents()
    else if (data?.role === 'student') fetchMyLessons(uid)

    if (isInitialLogin) {
      setCurrentView(data?.role === 'teacher' ? 'dashboard' : 'journal')
    }

    await fetchUnreadStatusRef.current?.(data)
    setLoading(false)
  }, [fetchStudents, fetchMyLessons, setCurrentView, fetchUnreadStatusRef])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id, true)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session) {
        const isInitial = event === 'SIGNED_IN' || event === 'INITIAL_SESSION'
        fetchProfile(session.user.id, isInitial)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoadingLogin(true)
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword })
    if (error) showAlert('Erro', error.message, 'error')
    setLoadingLogin(false)
  }

  return {
    session, profile, students, lessons, setLessons,
    loading, loginEmail, setLoginEmail, loginPassword, setLoginPassword,
    loadingLogin, handleLogin, fetchStudents, fetchMyLessons,
  }
}
