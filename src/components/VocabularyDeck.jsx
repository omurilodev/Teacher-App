import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import {
  BookText, Plus, Trash2, Search, Loader2,
  Languages, MessageSquareText, X, Sparkles, ChevronDown, Users, Check, Edit2
} from 'lucide-react';

export default function VocabularyDeck({ profile, session, selectedStudent, isDarkMode }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Estados de Edição (Adicionados)
  const [editingId, setEditingId] = useState(null);
  const [editTerm, setEditTerm] = useState('');
  const [editTranslation, setEditTranslation] = useState('');
  const [editExample, setEditExample] = useState('');

  // Form state
  const [term, setTerm] = useState('');
  const [translation, setTranslation] = useState('');
  const [exampleSentence, setExampleSentence] = useState('');

  // Teacher-side: internal student list + picked student
  const [studentsList, setStudentsList] = useState([]);
  const [pickedStudent, setPickedStudent] = useState(selectedStudent || null);

  const isStudent = profile?.role === 'student';
  const isTeacher = profile?.role === 'teacher';

  // Fetch students list for teacher dropdown
  useEffect(() => {
    if (!isTeacher) return;
    async function loadStudents() {
      const { data } = await supabase.from('profiles').select('id, full_name, role').eq('role', 'student');
      setStudentsList(data || []);
    }
    loadStudents();
  }, [isTeacher]);

  // Sync pickedStudent if selectedStudent prop changes
  useEffect(() => {
    if (selectedStudent) setPickedStudent(selectedStudent);
  }, [selectedStudent]);

  // The student whose deck we're viewing
  const activeStudent = isStudent ? null : pickedStudent;
  const targetStudentId = isStudent ? profile.id : activeStudent?.id;
  const targetStudentName = isStudent ? 'Your' : activeStudent?.full_name ? `${activeStudent.full_name}'s` : '';

  // Fetch vocabulary cards
  const fetchCards = useCallback(async () => {
    if (!targetStudentId) {
      setCards([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vocabulary_deck')
        .select('*')
        .eq('student_id', targetStudentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCards(data || []);
    } catch (err) {
      console.error('Error fetching vocabulary:', err);
    } finally {
      setLoading(false);
    }
  }, [targetStudentId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Real-time subscription for vocabulary changes
  useEffect(() => {
    if (!targetStudentId) return;

    const channel = supabase
      .channel(`vocab_${targetStudentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vocabulary_deck',
          filter: `student_id=eq.${targetStudentId}`,
        },
        () => {
          fetchCards(); // Refetch on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetStudentId, fetchCards]);

  // Add new card
  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!term.trim() || !translation.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('vocabulary_deck').insert({
        student_id: profile.id,
        term: term.trim(),
        translation: translation.trim(),
        example_sentence: exampleSentence.trim() || null,
      });

      if (error) throw error;

      setTerm('');
      setTranslation('');
      setExampleSentence('');
      setShowAddForm(false);
      fetchCards();
    } catch (err) {
      console.error('Error adding vocabulary:', err);
      alert('Error adding vocabulary card.');
    } finally {
      setSubmitting(false);
    }
  };

  // Função para salvar a edição (Adicionada)
  const handleSaveEdit = async (id) => {
    try {
      const { error } = await supabase.from('vocabulary_deck')
        .update({ term: editTerm, translation: editTranslation, example_sentence: editExample || null })
        .eq('id', id);
      if (error) throw error;
      setEditingId(null);
      fetchCards();
    } catch (err) { alert('Error updating card.'); }
  };

  // Delete card
  const handleDeleteCard = async (cardId) => {
    setDeleting(cardId);
    try {
      const { error } = await supabase.from('vocabulary_deck').delete().eq('id', cardId);
      if (error) throw error;
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    } catch (err) {
      console.error('Error deleting vocabulary:', err);
    } finally {
      setDeleting(null);
    }
  };

  // Filtered cards
  const filteredCards = cards.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.term?.toLowerCase().includes(q) ||
      c.translation?.toLowerCase().includes(q) ||
      c.example_sentence?.toLowerCase().includes(q)
    );
  });

  // Teacher view without a selected student — show student picker
  if (isTeacher && !activeStudent) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10 lg:p-12 animate-in fade-in duration-500">
        <div className="max-w-5xl mx-auto w-full pt-16 lg:pt-0">
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[var(--icon-bg)] text-[var(--icon-color)] rounded-xl flex items-center justify-center shadow-sm">
                <BookText size={20} />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-main)]">
                Vocabulary Decks
              </h1>
            </div>
            <p className="text-[var(--text-muted)] text-sm">Select a student to view their vocabulary deck</p>
          </header>
          <div className="flex flex-col gap-4">
            {(() => {
              const sorted = [...studentsList].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'pt-BR'))
              let lastLetter = null
              const items = []
              sorted.forEach(s => {
                const letter = s.full_name?.charAt(0).toUpperCase() || '#'
                if (letter !== lastLetter) {
                  lastLetter = letter
                  items.push(<div key={`sep-${letter}`} className="px-2 py-1 text-xs font-bold tracking-widest text-[var(--text-lighter)] uppercase">{letter}</div>)
                }
                items.push(
                  <div
                    key={s.id}
                    onClick={() => setPickedStudent(s)}
                    className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-5 rounded-2xl hover:shadow-md cursor-pointer transition-all flex items-center justify-between group shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[var(--icon-bg)] text-[var(--icon-color)] rounded-[1rem] flex items-center justify-center text-lg font-bold group-hover:bg-[#5A77DF] group-hover:text-white transition-all shadow-sm">
                        {s.full_name?.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[var(--text-main)] tracking-tight">{s.full_name}</h3>
                        <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-bold mt-0.5">View Vocabulary</p>
                      </div>
                    </div>
                    <ChevronDown size={18} className="text-[var(--text-lighter)] group-hover:text-[#5A77DF] transition-colors -rotate-90" />
                  </div>
                )
              })
              return items
            })()}
            {studentsList.length === 0 && (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-[var(--bg-card)] rounded-3xl shadow-sm border border-[var(--border-color)] flex items-center justify-center mb-6 mx-auto">
                  <Users size={36} className="text-[var(--text-lighter)] opacity-40" />
                </div>
                <p className="font-bold text-sm tracking-tight text-[var(--text-lighter)]">No students found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 lg:p-12 animate-in fade-in duration-500">
      <div className="max-w-5xl mx-auto w-full pt-16 lg:pt-0">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
          <div>
            {isTeacher && (
              <button onClick={() => setPickedStudent(null)} className="text-[10px] font-bold text-[var(--text-lighter)] hover:text-[#5A77DF] flex items-center gap-1 mb-3 tracking-widest transition-colors">
                <ChevronDown size={12} className="rotate-90" /> ALL STUDENTS
              </button>
            )}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[var(--icon-bg)] text-[var(--icon-color)] rounded-xl flex items-center justify-center shadow-sm">
                <BookText size={20} />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-main)]">
                {targetStudentName} Vocabulary Deck
              </h1>
            </div>
            <p className="text-[var(--text-muted)] text-sm">
              {isStudent
                ? 'Build your personal vocabulary collection'
                : `Viewing ${activeStudent?.full_name}'s vocabulary cards`}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-lighter)]"
              />
              <input
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 md:w-56 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] text-sm px-10 py-3 rounded-2xl outline-none focus:border-[#5A77DF] transition-all shadow-sm placeholder:text-[var(--text-lighter)]"
              />
            </div>

            {/* Add button (student only) */}
            {isStudent && (
              <button
                onClick={() => setShowAddForm(true)}
                className="shrink-0 flex items-center gap-2 bg-[#5A77DF] text-white font-bold text-sm px-5 py-3 rounded-2xl hover:bg-[#4a63be] transition-all shadow-lg active:scale-95"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Add Word</span>
              </button>
            )}
          </div>
        </header>

        {/* Stats bar */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs font-bold bg-[#5A77DF]/10 text-[#5A77DF] px-3 py-1.5 rounded-lg border border-[#5A77DF]/20">
            <Sparkles size={12} />
            {cards.length} card{cards.length !== 1 ? 's' : ''} total
          </span>
          {searchQuery && (
            <span className="flex items-center gap-1.5 text-xs font-bold bg-[var(--bg-input)] text-[var(--text-muted)] px-3 py-1.5 rounded-lg border border-[var(--border-color)]">
              <Search size={12} />
              {filteredCards.length} result{filteredCards.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Add Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-[var(--modal-overlay)] backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[var(--bg-card)] p-8 md:p-10 rounded-[2rem] max-w-md w-full shadow-2xl animate-in zoom-in-95 border border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#5A77DF]/10 text-[#5A77DF] rounded-xl flex items-center justify-center">
                    <Plus size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-main)] tracking-tight">
                    New Vocabulary
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-[var(--text-lighter)] hover:text-red-500 transition-colors bg-[var(--bg-input)] p-2 rounded-xl"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddCard} className="space-y-5">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest ml-4 mb-1.5 block">
                    Term / Word
                  </label>
                  <div className="relative">
                    <Languages
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-lighter)]"
                    />
                    <input
                      type="text"
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                      placeholder="e.g. Serendipity"
                      className="w-full pl-11 pr-6 py-4 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl text-[var(--text-main)] outline-none focus:border-[#5A77DF] transition-all text-base md:text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest ml-4 mb-1.5 block">
                    Translation
                  </label>
                  <input
                    type="text"
                    value={translation}
                    onChange={(e) => setTranslation(e.target.value)}
                    placeholder="e.g. Serendipidade"
                    className="w-full px-6 py-4 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl text-[var(--text-main)] outline-none focus:border-[#5A77DF] transition-all text-base md:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--text-lighter)] uppercase tracking-widest ml-4 mb-1.5 block">
                    Example Sentence <span className="text-[var(--text-lighter)]">(optional)</span>
                  </label>
                  <div className="relative">
                    <MessageSquareText
                      size={16}
                      className="absolute left-4 top-4 text-[var(--text-lighter)]"
                    />
                    <textarea
                      value={exampleSentence}
                      onChange={(e) => setExampleSentence(e.target.value)}
                      placeholder='e.g. "It was pure serendipity that we met."'
                      rows={3}
                      className="w-full pl-11 pr-6 py-4 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl text-[var(--text-main)] outline-none focus:border-[#5A77DF] transition-all text-base md:text-sm resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !term.trim() || !translation.trim()}
                  className="w-full bg-[#5A77DF] text-white font-bold py-4 rounded-2xl hover:bg-[#4a63be] transition-all shadow-lg mt-2 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {submitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Plus size={18} />
                  )}
                  {submitting ? 'Adding...' : 'Add to Deck'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin w-8 h-8 text-[#5A77DF]" />
          </div>
        )}

        {/* Cards Grid */}
        {!loading && (
          <>
            {filteredCards.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-[var(--bg-card)] rounded-3xl shadow-sm border border-[var(--border-color)] flex items-center justify-center mb-6 mx-auto">
                  <BookText size={36} className="text-[var(--text-lighter)] opacity-40" />
                </div>
                <p className="font-bold text-sm tracking-tight text-[var(--text-lighter)]">
                  {searchQuery
                    ? 'No cards match your search.'
                    : isStudent
                    ? 'Your deck is empty. Add your first word!'
                    : 'No vocabulary cards yet.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCards.map((card) => (
                  <div
                    key={card.id}
                    className="group bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
                  >
                    {/* Accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5A77DF] to-[#8B5CF6] opacity-60 group-hover:opacity-100 transition-opacity" />

                    {editingId === card.id ? (
                      <div className="space-y-3 animate-in fade-in">
                        <input value={editTerm} onChange={e => setEditTerm(e.target.value)} className="w-full font-bold bg-[var(--bg-input)] p-2 rounded-lg border border-[var(--border-color)]" placeholder="Term" />
                        <input value={editTranslation} onChange={e => setEditTranslation(e.target.value)} className="w-full text-[#5A77DF] font-semibold bg-[var(--bg-input)] p-2 rounded-lg border border-[var(--border-color)]" placeholder="Translation" />
                        <textarea value={editExample} onChange={e => setEditExample(e.target.value)} className="w-full text-xs bg-[var(--bg-input)] p-2 rounded-lg border border-[var(--border-color)]" rows={2} placeholder="Example sentence" />
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveEdit(card.id)} className="flex-1 bg-[#5A77DF] text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1">
                            <Check size={14} /> Save
                          </button>
                          <button onClick={() => setEditingId(null)} className="flex-1 bg-[var(--bg-input)] py-2 rounded-lg font-bold text-xs text-[var(--text-muted)]">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="absolute top-4 right-4 flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                          <button onClick={() => { setEditingId(card.id); setEditTerm(card.term); setEditTranslation(card.translation); setEditExample(card.example_sentence || ''); }} className="text-[var(--text-lighter)] hover:text-[#5A77DF] bg-[var(--bg-input)] p-1.5 rounded-lg border border-[var(--border-color)]"><Edit2 size={14}/></button>
                          <button onClick={() => handleDeleteCard(card.id)} className="text-[var(--text-lighter)] hover:text-red-500 bg-[var(--bg-input)] p-1.5 rounded-lg border border-[var(--border-color)]">
                             {deleting === card.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                        <h3 className="text-lg font-bold text-[var(--text-main)] tracking-tight mb-1 pr-16">{card.term}</h3>
                        <p className="text-[#5A77DF] font-semibold text-sm mb-3">{card.translation}</p>
                        {card.example_sentence && (
                          <div className="bg-[var(--bg-input)] rounded-xl px-4 py-3 border border-[var(--border-color)]">
                            <p className="text-[var(--text-muted)] text-xs italic leading-relaxed">"{card.example_sentence}"</p>
                          </div>
                        )}
                        <p className="text-[var(--text-lighter)] text-[10px] uppercase tracking-widest font-bold mt-3">
                          {new Date(card.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}