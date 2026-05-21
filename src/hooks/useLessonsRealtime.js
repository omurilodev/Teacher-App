import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

/**
 * Custom hook for real-time lessons synchronization.
 * Subscribes to INSERT, UPDATE, DELETE on the 'lessons' table.
 * 
 * @param {Object} options
 * @param {string} [options.studentId] - Filter by specific student
 * @param {string} [options.referenceMonth] - Filter by month ('YYYY-MM')
 * @returns {{ lessons: Array, loading: boolean, error: string|null, presenceState: Object, refetch: Function }}
 */
export function useLessonsRealtime({ studentId = null, referenceMonth = null } = {}) {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Stub for future presence / typing indicators
  const [presenceState, setPresenceState] = useState({
    onlineUsers: [],
    typingUsers: [],
  });

  // Initial fetch
  const fetchLessons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('lessons')
        .select('*, profiles:student_id(id, full_name, role)')
        .order('start_time', { ascending: false });

      if (studentId) {
        query = query.eq('student_id', studentId);
      }
      if (referenceMonth) {
        query = query.eq('reference_month', referenceMonth);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const fetched = data || [];

      // Auto-mark absent when viewing all lessons for a specific student
      if (studentId && !referenceMonth && fetched.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const toMark = fetched.filter(l =>
          l.class_date && l.class_date < today &&
          !l.student_checkin && !l.professor_checkin &&
          !l.end_time && !l.is_absent
        );
        if (toMark.length > 0) {
          const ids = toMark.map(l => l.id);
          const { error: absErr } = await supabase.from('lessons').update({ is_absent: true }).in('id', ids);
          if (!absErr) {
            setLessons(fetched.map(l => ids.includes(l.id) ? { ...l, is_absent: true } : l));
            return;
          }
        }
      }

      setLessons(fetched);
    } catch (err) {
      console.error('[useLessonsRealtime] fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [studentId, referenceMonth]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  // Real-time subscription
  useEffect(() => {
    const channelName = `lessons_realtime_${studentId || 'all'}_${referenceMonth || 'all'}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lessons',
          ...(studentId ? { filter: `student_id=eq.${studentId}` } : {}),
        },
        (payload) => {
          setLessons((prev) => {
            if (prev.find((l) => l.id === payload.new.id)) return prev;
            // If a referenceMonth filter is active, only add matching rows
            if (referenceMonth && payload.new.reference_month !== referenceMonth) return prev;
            return [payload.new, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lessons',
          ...(studentId ? { filter: `student_id=eq.${studentId}` } : {}),
        },
        (payload) => {
          setLessons((prev) =>
            prev.map((l) => (l.id === payload.new.id ? { ...l, ...payload.new } : l))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'lessons',
          ...(studentId ? { filter: `student_id=eq.${studentId}` } : {}),
        },
        (payload) => {
          setLessons((prev) => prev.filter((l) => l.id !== payload.old.id));
        }
      )
      .subscribe();

    // Presence channel stub — ready for future implementation
    const presenceChannel = supabase.channel(`presence_${channelName}`);
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users = Object.values(state).flat();
        setPresenceState((prev) => ({ ...prev, onlineUsers: users }));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setPresenceState((prev) => ({
          ...prev,
          onlineUsers: [...prev.onlineUsers, ...newPresences],
        }));
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const leftIds = leftPresences.map((p) => p.user_id);
        setPresenceState((prev) => ({
          ...prev,
          onlineUsers: prev.onlineUsers.filter((u) => !leftIds.includes(u.user_id)),
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [studentId, referenceMonth]);

  return { lessons, setLessons, loading, error, presenceState, refetch: fetchLessons };
}
