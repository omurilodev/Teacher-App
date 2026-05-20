import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase'

export function useMessages({ profile, session, selectedLesson, isMobileChatOpen, isChatOpen }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [unreadByStudent, setUnreadByStudent] = useState({})
  const [unreadByLesson, setUnreadByLesson] = useState({})

  const fetchUnreadStatus = useCallback(async (userProfile) => {
    if (!userProfile) return
    try {
      const { data: lessonsData } = await supabase.from('lessons').select('id, student_id')
      const { data: unreadData } = await supabase.from('messages')
        .select('lesson_id')
        .eq('is_read', false)
        .neq('sender_id', userProfile.id)

      if (unreadData && lessonsData) {
        const studentDots = {}
        const lessonDots = {}
        unreadData.forEach(msg => {
          lessonDots[msg.lesson_id] = true
          const lesson = lessonsData.find(l => l.id === msg.lesson_id)
          if (lesson) studentDots[lesson.student_id] = true
        })
        setUnreadByStudent(studentDots)
        setUnreadByLesson(lessonDots)
      }
    } catch (e) { console.log(e) }
  }, [])

  const markMessagesAsRead = useCallback(async (lessonId) => {
    if (!profile || !lessonId) return
    await supabase.from('messages')
      .update({ is_read: true })
      .eq('lesson_id', lessonId)
      .neq('sender_id', profile.id)
    fetchUnreadStatus(profile)
  }, [profile, fetchUnreadStatus])

  const sendMessage = useCallback(async (e) => {
    e.preventDefault()
    const msg = newMessage.trim()
    if (!msg || !session?.user || !selectedLesson) return
    const { data, error } = await supabase.from('messages')
      .insert({ lesson_id: selectedLesson.id, sender_id: session.user.id, content: msg })
      .select()
    if (!error) { setMessages((prev) => [...prev, data[0]]); setNewMessage('') }
  }, [newMessage, session, selectedLesson])

  useEffect(() => {
    if (!profile) return
    const globalChannel = supabase.channel('global_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        () => { fetchUnreadStatus(profile) }).subscribe()
    return () => { supabase.removeChannel(globalChannel) }
  }, [profile, fetchUnreadStatus])

  useEffect(() => {
    if (!selectedLesson) return
    const channel = supabase.channel(`chat_room_${selectedLesson.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `lesson_id=eq.${selectedLesson.id}` },
        (payload) => {
          setMessages((prev) => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
          if (isMobileChatOpen || (isChatOpen && window.innerWidth >= 1024 && selectedLesson)) {
            markMessagesAsRead(selectedLesson.id)
          }
        }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedLesson, isMobileChatOpen, isChatOpen, markMessagesAsRead])

  return {
    messages, setMessages, newMessage, setNewMessage,
    unreadByStudent, unreadByLesson,
    fetchUnreadStatus, markMessagesAsRead, sendMessage,
  }
}
