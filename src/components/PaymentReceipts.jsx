import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { Upload, FileText, Image as ImageIcon, Download, Loader2, Receipt } from 'lucide-react';
import { showAlert } from './AlertModal';

export default function PaymentReceipts({ studentId, isTeacher }) {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const fetchReceipts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payment_receipts')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    setReceipts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (studentId) fetchReceipts();
  }, [studentId]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);

    const safeName = file.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${studentId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('payment-receipts')
      .upload(filePath, file, {
        onUploadProgress: ({ loaded, total }) => {
          setProgress(Math.round((loaded / total) * 100));
        },
      });

    if (uploadError) {
      showAlert('Erro', 'Erro ao fazer upload: ' + uploadError.message, 'error');
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const { error: dbError } = await supabase.from('payment_receipts').insert({
      student_id: studentId,
      file_path: filePath,
      file_name: file.name,
      file_type: file.type,
    });

    if (dbError) {
      showAlert('Erro', 'Erro ao salvar referência: ' + dbError.message, 'error');
    } else {
      showAlert('Sucesso', 'Comprovante enviado com sucesso!', 'success');
      await fetchReceipts();
    }

    setUploading(false);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openReceipt = async (receipt) => {
    const { data, error } = await supabase.storage
      .from('payment-receipts')
      .createSignedUrl(receipt.file_path, 3600);

    if (error || !data?.signedUrl) {
      showAlert('Erro', 'Não foi possível abrir o arquivo.', 'error');
      return;
    }

    window.open(data.signedUrl, '_blank');
  };

  const isPdf = (fileType) => fileType === 'application/pdf';

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin w-6 h-6 text-[#5A77DF]" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      {!isTeacher && (
        <div className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-[#5A77DF] text-white font-bold text-sm px-5 py-3 rounded-2xl hover:bg-[#4a63be] transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? `Enviando... ${progress}%` : 'Enviar Comprovante'}
          </button>

          {uploading && (
            <div className="mt-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-3">
              <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1.5">
                <span>Enviando arquivo...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-[var(--bg-input)] rounded-full h-2">
                <div
                  className="bg-[#5A77DF] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {receipts.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-16 h-16 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Receipt size={28} className="text-[var(--text-lighter)] opacity-40" />
          </div>
          <p className="text-sm text-[var(--text-lighter)]">
            {isTeacher ? 'Nenhum comprovante enviado.' : 'Você ainda não enviou nenhum comprovante.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {receipts.map(receipt => (
            <div key={receipt.id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPdf(receipt.file_type) ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                  {isPdf(receipt.file_type) ? <FileText size={18} /> : <ImageIcon size={18} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--text-main)] truncate">{receipt.file_name}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {new Date(receipt.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => openReceipt(receipt)}
                className="shrink-0 p-2 rounded-xl text-[var(--text-lighter)] hover:text-[#5A77DF] hover:bg-[#5A77DF]/10 transition-all border border-[var(--border-color)]"
                title="Visualizar / Baixar"
              >
                <Download size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
