import React, { useEffect, useRef, memo } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { supabase } from '../supabase';

const CollaborativeEditor = memo(function CollaborativeEditor({ 
  lessonId, 
  initialContent, 
  setContent, // Voltamos com ele de forma segura!
  modules, 
  profile 
}) {
  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const pendingSaveRef = useRef(false); // Nova "bandeira" para avisar que tem texto não salvo

  useEffect(() => {
    if (!containerRef.current || !lessonId) return;

    containerRef.current.innerHTML = '';
    const editorDiv = document.createElement('div');
    containerRef.current.appendChild(editorDiv);

    const editor = new Quill(editorDiv, {
      theme: 'snow',
      modules: modules
    });

    if (initialContent) {
      editor.clipboard.dangerouslyPasteHTML(initialContent);
    }

    const channelName = `journal-sync-${lessonId}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'delta-update' }, ({ payload }) => {
        if (editor) editor.updateContents(payload);
      })
      .subscribe();

    // 🚀 A NOVA ARMA SECRETA: Função que força o salvamento imediato
    const forceSave = async () => {
      if (!pendingSaveRef.current) return;
      const currentHTML = editor.root.innerHTML;
      try {
        await supabase.from('lessons').update({ content: currentHTML }).eq('id', lessonId);
        if (setContent) setContent(currentHTML); // Atualiza a memória do App.jsx
        pendingSaveRef.current = false; // Abaixa a bandeira de pendência
      } catch (err) {
        console.error('Erro no save forçado:', err);
      }
    };

    editor.on('text-change', (delta, oldDelta, source) => {
      if (source === 'user') {
        pendingSaveRef.current = true; // Levanta a bandeira: "Temos texto novo!"

        channel.send({
          type: 'broadcast',
          event: 'delta-update',
          payload: delta
        });

        // Cronômetro normal de 1 segundo
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          forceSave();
        }, 1000); 
      }
    });

    // 🔒 PROTEÇÃO 1: Salva na hora se você clicar fora do texto (ex: clicar no chat)
    editor.root.addEventListener('blur', () => {
      if (pendingSaveRef.current) forceSave();
    });

    // 🔒 PROTEÇÃO 2: Trava o F5 e aba de fechamento se tiver algo não salvo
    const handleBeforeUnload = (e) => {
      if (pendingSaveRef.current) {
        forceSave(); // Tenta salvar no último milissegundo
        e.preventDefault();
        e.returnValue = ''; // Faz o navegador perguntar "Tem certeza que deseja sair?"
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(debounceTimerRef.current);
      forceSave(); // Salva uma última vez antes de trocar de aula
      editor.off('text-change');
      supabase.removeChannel(channel);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [lessonId]); 

  return (
    <div 
      className="h-full flex-1 flex flex-col editor-clean border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm bg-[var(--bg-card)] text-[var(--text-main)]" 
      ref={containerRef} 
    />
  );
}, (prevProps, nextProps) => prevProps.lessonId === nextProps.lessonId);

export default CollaborativeEditor;