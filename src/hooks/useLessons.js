import { useState, useCallback } from 'react'
import { supabase } from '../supabase'
import { showAlert } from '../components/AlertModal'

export function useLessons({ selectedStudent, selectedLesson, setSelectedLesson, lessons, setLessons, fetchMyLessons, selectLessonRef }) {
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(null)
  const [isCheckingIn, setIsCheckingIn] = useState(false)

  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editClassDate, setEditClassDate] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editIsMakeup, setEditIsMakeup] = useState(false)
  const [editLateNotice, setEditLateNotice] = useState(false)
  const [editExtraFeePaid, setEditExtraFeePaid] = useState(false)

  const handleNewLesson = useCallback(() => {
    const now = new Date()
    setIsCreating(true)
    setIsEditing(false)
    setEditTitle('')
    setEditContent('')
    setEditClassDate(now.toISOString().split('T')[0])
    setEditStartTime(now.toTimeString().split(' ')[0].substring(0, 5))
    setEditEndTime('')
    setEditIsMakeup(false)
    setEditLateNotice(false)
    setEditExtraFeePaid(false)
  }, [])

  const handleSaveLesson = useCallback(async (e) => {
    e.preventDefault()
    if (!selectedStudent) return
    try {
      let duration_minutes = 0
      if (editStartTime && editEndTime) {
        const start = new Date(`1970-01-01T${editStartTime}:00`)
        const end = new Date(`1970-01-01T${editEndTime}:00`)
        duration_minutes = Math.round((end - start) / 60000)
      }

      let refMonth = null
      if (editClassDate) {
        const [year, month] = editClassDate.split('-')
        refMonth = `${year}-${month}`
      } else {
        const now = new Date()
        refMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
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
        is_absent: false,
        is_makeup: editIsMakeup,
        late_notice: editLateNotice,
        extra_fee_paid: editExtraFeePaid,
      }

      if (isEditing) {
        const { data, error } = await supabase.from('lessons').update(lessonData).eq('id', selectedLesson.id).select()
        if (error) throw error
        if (data && data[0]) {
          setLessons(lessons.map(l => l.id === selectedLesson.id ? data[0] : l))
          selectLessonRef.current?.(data[0], 'view')
        }
      } else {
        const { data, error } = await supabase.from('lessons').insert(lessonData).select()
        if (error) throw error
        if (data && data[0]) {
          setLessons([data[0], ...lessons])
          selectLessonRef.current?.(data[0], 'view')
        } else {
          fetchMyLessons(selectedStudent.id)
          setIsCreating(false)
        }
      }
    } catch (err) {
      console.error(err)
      showAlert('Erro', 'Não foi possível salvar a aula.', 'error')
    }
  }, [selectedStudent, selectedLesson, isEditing, lessons, setLessons, fetchMyLessons, selectLessonRef, editTitle, editContent, editClassDate, editStartTime, editEndTime, editIsMakeup, editLateNotice, editExtraFeePaid])

  const handleFinishLesson = useCallback(async () => {
    if (!selectedLesson) return
    try {
      const now = new Date()
      const end_time = now.toTimeString().split(' ')[0].substring(0, 5)

      let duration_minutes = selectedLesson.duration_minutes || 0
      const startTime = selectedLesson.start_time

      if (startTime) {
        const start = new Date(`1970-01-01T${startTime.substring(0, 5)}:00`)
        const end = new Date(`1970-01-01T${end_time}:00`)
        duration_minutes = Math.round((end - start) / 60000)
        if (duration_minutes < 0) duration_minutes = 0
      }

      const { data, error } = await supabase.from('lessons')
        .update({ end_time, duration_minutes, professor_checkin: true })
        .eq('id', selectedLesson.id).select()

      if (error) throw error

      if (data && data[0]) {
        setSelectedLesson(data[0])
        setLessons(lessons.map(l => l.id === selectedLesson.id ? data[0] : l))
      }
    } catch (err) {
      console.error(err)
      showAlert('Erro', 'Não foi possível encerrar a aula.', 'error')
    }
  }, [selectedLesson, setSelectedLesson, lessons, setLessons])

  const handleStudentCheckin = useCallback(async () => {
    if (!selectedLesson) return
    setIsCheckingIn(true)
    try {
      const { data, error } = await supabase.from('lessons')
        .update({ student_checkin: true })
        .eq('id', selectedLesson.id).select()

      if (error) throw error

      if (!data || data.length === 0) {
        showAlert('Atenção', 'Bloqueio de Segurança: o banco de dados não permitiu a ação (RLS). Execute o código SQL no Supabase para liberar.', 'info')
        return
      }

      if (data && data[0]) {
        setSelectedLesson(data[0])
        setLessons(lessons.map(l => l.id === selectedLesson.id ? data[0] : l))
      }
    } catch (err) {
      console.error(err)
      showAlert('Erro', 'Não foi possível confirmar sua presença.', 'error')
    } finally {
      setIsCheckingIn(false)
    }
  }, [selectedLesson, setSelectedLesson, lessons, setLessons])

  const handleDeleteLesson = useCallback(async () => {
    const { error } = await supabase.from('lessons').delete().eq('id', showDeleteModal)
    if (!error) {
      setLessons(lessons.filter(l => l.id !== showDeleteModal))
      if (selectedLesson?.id === showDeleteModal) setSelectedLesson(null)
      setShowDeleteModal(null)
    }
  }, [showDeleteModal, lessons, setLessons, selectedLesson, setSelectedLesson])

  return {
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
  }
}
