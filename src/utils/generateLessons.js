import { supabase } from '../supabase';

export async function generateLessonsForSchedule(studentId, dayOfWeek, startTime, lastPaymentDate = null) {
  let startDateStr = lastPaymentDate;
  if (!startDateStr) {
    const { data: profile } = await supabase
      .from('profiles').select('last_payment_date').eq('id', studentId).single();
    startDateStr = profile?.last_payment_date || new Date().toISOString().split('T')[0];
  }

  const occurrences = [];
  const cursor = new Date(startDateStr + 'T00:00:00');
  while (occurrences.length < 4) {
    if (cursor.getDay() === dayOfWeek) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      occurrences.push(`${y}-${m}-${d}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const { data: existing } = await supabase
    .from('lessons').select('class_date').eq('student_id', studentId).in('class_date', occurrences);

  const existingDates = new Set((existing || []).map(l => l.class_date));
  const normalizedTime = /^\d{2}:\d{2}$/.test(startTime) ? startTime + ':00' : startTime;

  const toCreate = occurrences
    .filter(ds => !existingDates.has(ds))
    .map(ds => {
      const [y, m, day] = ds.split('-');
      return {
        title: `Aula — ${day}/${m}/${y}`,
        student_id: studentId,
        class_date: ds,
        start_time: normalizedTime,
        reference_month: ds.substring(0, 7),
        professor_checkin: false,
        student_checkin: false,
        is_absent: false,
        is_makeup: false,
        content: '<p><br></p>',
      };
    });

  if (toCreate.length > 0) {
    await supabase.from('lessons').insert(toCreate);
  }
}

// Fetches all fixed schedules for the student and creates the next 4 lessons for each.
// Returns true if the student had at least one schedule, false otherwise.
export async function generateAllScheduleLessons(studentId, lastPaymentDate = null) {
  const { data: schedules } = await supabase
    .from('schedules').select('*').eq('student_id', studentId);

  if (!schedules || schedules.length === 0) return false;

  await Promise.all(
    schedules.map(s =>
      generateLessonsForSchedule(studentId, s.day_of_week, s.start_time, lastPaymentDate)
    )
  );

  return true;
}
