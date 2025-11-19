
import React, { useState, useEffect } from 'react';
import { FileText, Sparkles, Save, Trash2, Code, Upload, RefreshCw, AlertCircle, HelpCircle, X } from 'lucide-react';
import { API_BASE_URL } from '../constants';
import { LOGIC_TEMPLATE_JSON, LOGIC_TEMPLATE_TXT } from '../constants';

interface LogicManagerProps {
  sessionId: string | null;
  isDemo?: boolean;
}

export const LogicManager: React.FC<LogicManagerProps> = ({ sessionId, isDemo }) => {
  const [files, setFiles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'files' | 'generator'>('files');
  const [prompt, setPrompt] = useState('');
  const [generatedJson, setGeneratedJson] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [txtContent, setTxtContent] = useState('');
  const [txtFileName, setTxtFileName] = useState('conhecimento.txt');
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (sessionId) {
        if (isDemo) {
            setFiles(['regras.json', 'info.txt']);
            setError(null);
        } else {
            fetchFiles();
        }
    } else {
        setFiles([]);
    }
  }, [sessionId, isDemo]);

  const fetchFiles = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/logics`);
      if (!res.ok) {
        // If 404, it might just be that the folder doesn't exist yet, which is fine.
        if (res.status === 404) {
            setFiles([]);
            return;
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
      setError(null);
    } catch (error) {
      console.error("Erro ao buscar arquivos", error);
      // Don't clear files immediately to avoid UI jumping if it's a temporary glitch
      setError("Falha ao carregar arquivos. Verifique a conexão.");
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!sessionId || !confirm(`Deletar ${fileName}?`)) return;
    
    if (isDemo) {
        setFiles(files.filter(f => f !== fileName));
        return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/logics/${fileName}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete');
      fetchFiles();
    } catch (error) {
      alert("Erro ao deletar arquivo.");
    }
  };

  const handleGenerateRules = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    
    if (isDemo) {
        setTimeout(() => {
            setGeneratedJson(LOGIC_TEMPLATE_JSON);
            setIsGenerating(false);
        }, 1500);
        return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/generate-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!res.ok) throw new Error('Failed to generate rules');
      const data = await res.json();
      setGeneratedJson(JSON.stringify(data, null, 2));
    } catch (error) {
      alert("Erro ao gerar regras com IA. Verifique API Key e conexão.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveJson = async () => {
    if (!sessionId || !generatedJson) return;
    
    if (isDemo) {
        setFiles([...files, 'regras.json']);
        alert("Regras salvas (Simulação)!");
        setActiveTab('files');
        return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/logics/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: 'regras.json', content: generatedJson })
      });
      if (!res.ok) throw new Error('Failed to save');
      alert("Regras salvas!");
      fetchFiles();
      setActiveTab('files');
    } catch (error) {
      alert("Erro ao salvar regras.");
    }
  };

  const handleSaveTxt = async () => {
    if (!sessionId || !txtContent) return;
    
    if (isDemo) {
        setFiles([...files, txtFileName]);
        alert("Base de conhecimento salva (Simulação)!");
        setTxtContent('');
        return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/logics/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: txtFileName, content: txtContent })
      });
      if (!res.ok) throw new Error('Failed to save');
      alert("Base de conhecimento salva!");
      setTxtContent('');
      fetchFiles();
    } catch (error) {
      alert("Erro ao salvar arquivo.");
    }
  };

  if (!sessionId) {
    return (
      <div className="bg-slate-800 rounded-xl p-8 text-center border border-slate-700 text-slate-400 flex flex-col items-center justify-center h-full">
        <FileText size={48} className="mb-4 opacity-50" />
        <p>Selecione um dispositivo para gerenciar sua inteligência.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden flex flex-col h-[600px] relative">
      
      {/* Help Modal */}
      {showHelp && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 p-6 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Como testar as Lógicas?</h3>
                <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white"><X size={24}/></button>
            </div>
            <div className="space-y-6 text-sm text-slate-300">
                <div className="bg-slate-800 p-4 rounded border border-slate-700">
                    <h4 className="text-green-400 font-bold mb-2">1. Testando Arquivos .JSON (Regras Exatas)</h4>
                    <p className="mb-2">Crie um arquivo chamado <code>regras.json</code>. O bot verifica isso PRIMEIRO.</p>
                    <pre className="bg-black p-3 rounded font-mono text-xs text-yellow-500 overflow-x-auto">
                        {LOGIC_TEMPLATE_JSON}
                    </pre>
                    <p className="mt-2 text-xs italic">Teste: Envie "preço" no WhatsApp para o bot e ele responderá exatamente o texto configurado.</p>
                </div>
                <div className="bg-slate-800 p-4 rounded border border-slate-700">
                    <h4 className="text-blue-400 font-bold mb-2">2. Testando Arquivos .TXT (Inteligência Artificial)</h4>
                    <p className="mb-2">Crie um arquivo (ex: <code>info.txt</code>). O bot usa isso se nenhuma regra JSON for encontrada.</p>
                    <pre className="bg-black p-3 rounded font-mono text-xs text-blue-300 overflow-x-auto">
                        {LOGIC_TEMPLATE_TXT}
                    </pre>
                    <p className="mt-2 text-xs italic">Teste: Pergunte "Quais os horários?" e a IA usará esse texto para criar uma resposta natural.</p>
                </div>
            </div>
        </div>
      )}

      <div className="bg-slate-700/50 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Code size={18} className="text-purple-400"/> Base de Conhecimento
        </h2>
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowHelp(true)}
                className="text-slate-400 hover:text-yellow-400 transition-colors mr-2" 
                title="Ver Exemplos"
            >
                <HelpCircle size={18} />
            </button>
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-600">
            <button 
                onClick={() => setActiveTab('files')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${activeTab === 'files' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
                Arquivos
            </button>
            <button 
                onClick={() => setActiveTab('generator')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${activeTab === 'generator' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
                Gerador IA
            </button>
            </div>
        </div>
      </div>

      <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
        {activeTab === 'files' ? (
          <div className="space-y-6">
            {error && (
                <div className="bg-red-900/30 border border-red-800 p-3 rounded text-red-200 text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={fetchFiles} className="text-xs bg-red-800 px-2 py-1 rounded hover:bg-red-700">Tentar</button>
                </div>
            )}
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Upload size={16} /> Adicionar Conhecimento (TXT)
              </h3>
              <div className="space-y-3">
                <input 
                  type="text" 
                  value={txtFileName}
                  onChange={(e) => setTxtFileName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  placeholder="Nome do arquivo (ex: info.txt)"
                />
                <textarea
                  value={txtContent}
                  onChange={(e) => setTxtContent(e.target.value)}
                  className="w-full h-32 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  placeholder="Cole aqui informações da empresa. A IA usará isso para responder."
                />
                <button 
                  onClick={handleSaveTxt}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Save size={16} /> Salvar Conhecimento
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-400 mb-3 flex items-center justify-between">
                <span>Arquivos Ativos</span>
                <button onClick={fetchFiles} className="text-slate-500 hover:text-white" title="Atualizar"><RefreshCw size={14}/></button>
              </h3>
              <div className="space-y-2">
                {files.length === 0 && !error && <p className="text-slate-500 text-sm italic">Nenhum arquivo encontrado.</p>}
                {files.map(file => (
                  <div key={file} className="flex items-center justify-between bg-slate-700/30 p-3 rounded border border-slate-600 hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {file.endsWith('.json') ? <Code size={16} className="text-yellow-500"/> : <FileText size={16} className="text-blue-400"/>}
                      <span className="text-sm text-slate-200">{file}</span>
                    </div>
                    <button 
                      onClick={() => handleDelete(file)}
                      className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 h-full flex flex-col">
            <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-500/30">
              <h3 className="text-sm font-bold text-purple-300 mb-2 flex items-center gap-2">
                <Sparkles size={16} /> Criar Regras com Gemini
              </h3>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-24 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 mb-3 focus:outline-none"
                placeholder="Descreva as regras: 'Quando falarem Oi, responda Olá. Se falarem preço, mande a tabela...'"
              />
              <button 
                onClick={handleGenerateRules}
                disabled={isGenerating}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {isGenerating ? <RefreshCw size={16} className="animate-spin"/> : <Sparkles size={16} />}
                Gerar JSON
              </button>
            </div>

            {generatedJson && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-slate-300">Resultado</h3>
                  <button 
                    onClick={handleSaveJson}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <Save size={12} /> Salvar regras.json
                  </button>
                </div>
                <pre className="flex-1 bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs text-green-400 font-mono overflow-auto custom-scrollbar">
                  {generatedJson}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
