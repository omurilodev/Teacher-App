import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, AlertCircle, X } from 'lucide-react';

export const showAlert = (title, message, type = 'error') => {
  window.dispatchEvent(new CustomEvent('show-alert', { detail: { title, message, type } }));
};

export const showConfirm = (title, message, onConfirm, type = 'error') => {
  window.dispatchEvent(new CustomEvent('show-confirm', { detail: { title, message, onConfirm, type } }));
};

// Sobrescreve o window.alert para que as chamadas antigas mostrem o modal
// assume que chamadas diretas são sempre de atenção
if (typeof window !== 'undefined') {
  window.alert = (message) => {
    // Se a mensagem contiver "sucesso", "cadastrado", "confirmada", usamos sucesso
    const msgLower = String(message).toLowerCase();
    let type = 'error';
    let title = 'Atenção';
    if (msgLower.includes('sucesso')) {
      type = 'success';
      title = 'Sucesso';
    } else if (msgLower.includes('erro') || msgLower.includes('falha') || msgLower.includes('error')) {
      type = 'error';
      title = 'Erro';
    } else {
      type = 'info';
    }
    showAlert(title, message, type);
  };
}

export default function AlertModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'error', onConfirm: null });

  useEffect(() => {
    const handleShowAlert = (e) => {
      setAlertData({ ...e.detail, onConfirm: null });
      setIsOpen(true);
    };
    const handleShowConfirm = (e) => {
      setAlertData({ title: e.detail.title, message: e.detail.message, type: e.detail.type || 'error', onConfirm: e.detail.onConfirm });
      setIsOpen(true);
    };
    window.addEventListener('show-alert', handleShowAlert);
    window.addEventListener('show-confirm', handleShowConfirm);
    return () => {
      window.removeEventListener('show-alert', handleShowAlert);
      window.removeEventListener('show-confirm', handleShowConfirm);
    };
  }, []);

  if (!isOpen) return null;

  const icons = {
    error: <AlertTriangle size={30} />,
    success: <CheckCircle2 size={30} />,
    info: <AlertCircle size={30} />
  };

  const colors = {
    error: 'bg-red-500/10 text-red-500 shadow-red-500/20',
    success: 'bg-emerald-500/10 text-emerald-500 shadow-emerald-500/20',
    info: 'bg-blue-500/10 text-blue-500 shadow-blue-500/20'
  };

  const buttonColors = {
    error: 'bg-red-500 hover:bg-red-600',
    success: 'bg-emerald-500 hover:bg-emerald-600',
    info: 'bg-blue-500 hover:bg-blue-600'
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--bg-card)] p-8 md:p-10 rounded-[2rem] max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 border border-[var(--border-color)] relative">
        <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-[var(--text-lighter)] hover:text-[var(--text-main)] transition-colors p-2 bg-[var(--bg-input)] rounded-full">
          <X size={16} />
        </button>
        <div className={`w-16 h-16 md:w-20 md:h-20 ${colors[alertData.type].split(' ')[0]} ${colors[alertData.type].split(' ')[1]} rounded-full flex items-center justify-center mx-auto mb-6`}>
          {icons[alertData.type]}
        </div>
        <h3 className="text-xl font-bold text-[var(--text-main)] mb-2 tracking-tight">{alertData.title}</h3>
        <p className="text-[var(--text-muted)] text-sm mb-8 leading-relaxed">{alertData.message}</p>
        {alertData.onConfirm ? (
          <div className="flex flex-col gap-3">
            <button onClick={() => { alertData.onConfirm(); setIsOpen(false); }} className={`w-full text-white font-bold py-4 rounded-xl shadow-md text-sm uppercase tracking-widest transition-all ${buttonColors[alertData.type]}`}>
              Confirmar
            </button>
            <button onClick={() => setIsOpen(false)} className="w-full bg-[var(--bg-input)] text-[var(--text-main)] font-bold py-4 rounded-xl border border-[var(--border-color)] text-sm uppercase tracking-widest">
              Cancelar
            </button>
          </div>
        ) : (
          <button onClick={() => setIsOpen(false)} className={`w-full text-white font-bold py-4 rounded-xl shadow-md text-sm uppercase tracking-widest transition-all ${buttonColors[alertData.type]}`}>
            OK
          </button>
        )}
      </div>
    </div>
  );
}
