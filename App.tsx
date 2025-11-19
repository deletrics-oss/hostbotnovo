
import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Wifi, 
  Smartphone, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Bot,
  Sparkles,
  LogOut,
  CreditCard,
  FileText,
  Image as ImageIcon,
  MoreVertical,
  Smile,
  AlertCircle,
  ShieldAlert,
  Settings,
  Database,
  Loader2
} from 'lucide-react';
import { Device, Conversation, Message, ConnectionStatus } from './types';
import { INITIAL_CONVERSATIONS, API_BASE_URL } from './constants';
import { LoginScreen } from './components/LoginScreen';
import { generateSmartReply } from './services/geminiService';
import { StripeModal } from './components/StripeModal';
import { LogicManager } from './components/LogicManager';
import { ClientManager } from './components/ClientManager';
import { authService } from './services/authService';

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(INITIAL_CONVERSATIONS[0].id);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [inputText, setInputText] = useState('');
  const [isGeminiGenerating, setIsGeminiGenerating] = useState(false);
  const [isStripeModalOpen, setIsStripeModalOpen] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [currentPlanName, setCurrentPlanName] = useState('Grátis');
  const [apiError, setApiError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'clients'>('chat');
  
  const [systemStatus, setSystemStatus] = useState({
    gemini: true,
    websocket: true,
    latency: 45
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Safe Boot Initialization
  useEffect(() => {
    const initApp = async () => {
      try {
        const token = localStorage.getItem('token');
        const demo = localStorage.getItem('isDemo') === 'true';
        
        if (token || demo) {
            setIsAuthenticated(true);
            setIsDemoMode(demo);
            if (!demo) {
                try {
                    await fetchUserProfile();
                } catch (e) {
                    console.warn("Profile fetch failed during init, keeping session active but limiting features.", e);
                }
            } else {
                setupDemoData();
            }
        }
      } catch (error) {
        console.error("Critical Initialization Error:", error);
        setIsAuthenticated(false);
        localStorage.removeItem('token');
      } finally {
        setIsInitializing(false);
      }
    };
    
    initApp();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, selectedConvId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (isDemoMode) return; 

    fetchSessions();
    const interval = setInterval(() => {
      fetchSessions();
      if(selectedDeviceId) fetchQrCode(selectedDeviceId);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, selectedDeviceId, isDemoMode]);

  const setupDemoData = () => {
      setIsSubscribed(true);
      setCurrentPlanName('Demo Pro');
      setDevices([
          { id: 'demo-device-1', name: 'Vendas Principal', status: ConnectionStatus.CONNECTED, phoneNumber: '5511999999999' },
          { id: 'demo-device-2', name: 'Suporte', status: ConnectionStatus.DISCONNECTED, phoneNumber: '' }
      ]);
      setSelectedDeviceId('demo-device-1');
      setApiError(null);
  };

  const fetchUserProfile = async () => {
      try {
          const user = await authService.getUserProfile();
          if (user) {
              if (user.plan && user.plan !== 'plan_free') {
                  setIsSubscribed(true);
                  setCurrentPlanName(user.plan === 'prod_TSBEUvesZnyFJO' ? 'Mensal' : 
                                   user.plan === 'prod_TSBFAZOMsCNIAT' ? 'Bot Fixo' : 'Pro');
              } else {
                  setIsSubscribed(false);
                  setCurrentPlanName('Grátis');
              }
          }
      } catch (e) {
          console.error("Failed to fetch user profile", e);
          throw e; 
      }
  };

  const fetchSessions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions`);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      
      const mappedDevices: Device[] = data.map((session: any) => ({
        id: session.id,
        name: session.id,
        status: session.status === 'READY' ? ConnectionStatus.CONNECTED : 
               session.status === 'QR_PENDING' ? ConnectionStatus.CONNECTING : 
               ConnectionStatus.DISCONNECTED,
        phoneNumber: ''
      }));
      
      setDevices(mappedDevices);
      setApiError(null);
    } catch (error) {
      console.error("API Error:", error);
      const isMixedContent = window.location.protocol === 'https:' && API_BASE_URL.startsWith('http:');
      setApiError(isMixedContent 
        ? "Erro de Mixed Content: Navegador bloqueou acesso HTTP. Clique em 'Alterar URL' para corrigir." 
        : "Erro ao conectar com o servidor.");
    }
  };

  const fetchQrCode = async (sessionId: string) => {
      try {
          const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/qr`);
          if(res.ok) {
              const data = await res.json();
              setQrCode(data.qrCodeUrl);
          }
      } catch(e) { console.error(e); }
  };

  const handleChangeApiUrl = () => {
      const newUrl = prompt("Insira a nova URL da API:", API_BASE_URL);
      if (newUrl && newUrl !== API_BASE_URL) {
          localStorage.setItem('custom_api_url', newUrl);
          window.location.reload();
      }
  };

  const handleLogin = (demo: boolean = false) => {
      setIsAuthenticated(true);
      setIsDemoMode(demo);
      localStorage.setItem('isDemo', String(demo));
      if (demo) {
          setupDemoData();
      } else {
          fetchUserProfile();
      }
  };
  
  const handleLogout = async () => {
    await authService.logout();
    setIsAuthenticated(false);
    setIsDemoMode(false);
    localStorage.removeItem('token');
    localStorage.removeItem('isDemo');
  };

  const handleAddDevice = async () => {
    if (!newDeviceName.trim()) return;
    
    if (isDemoMode) {
        const newDev: Device = { id: newDeviceName, name: newDeviceName, status: ConnectionStatus.CONNECTING, phoneNumber: '' };
        setDevices([...devices, newDev]);
        setNewDeviceName('');
        setTimeout(() => {
            setDevices(prev => prev.map(d => d.id === newDev.id ? {...d, status: ConnectionStatus.CONNECTED} : d));
            setSelectedDeviceId(newDev.id);
        }, 2000);
        return;
    }

    try {
      await fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: newDeviceName })
      });
      setNewDeviceName('');
      fetchSessions();
      setTimeout(() => setSelectedDeviceId(newDeviceName), 500);
    } catch (error) {
      alert("Erro ao criar sessão.");
    }
  };

  const handleRemoveDevice = async (id: string) => {
    if (!confirm(`Desconectar e Remover o dispositivo ${id}?`)) return;
    
    if (isDemoMode) {
        setDevices(devices.filter(d => d.id !== id));
        if (selectedDeviceId === id) setSelectedDeviceId(null);
        return;
    }

    try {
      await fetch(`${API_BASE_URL}/sessions/${id}`, {
        method: 'DELETE'
      });
      setDevices(devices.filter(d => d.id !== id));
      if (selectedDeviceId === id) {
          setSelectedDeviceId(null);
          setQrCode(null);
      }
    } catch (error) {
      alert("Erro ao remover dispositivo.");
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedConvId) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'bot',
      text: inputText,
      timestamp: new Date()
    };

    setConversations(prev => prev.map(conv => {
      if (conv.id === selectedConvId) {
        return {
          ...conv,
          messages: [...conv.messages, newMessage],
          lastMessage: inputText
        };
      }
      return conv;
    }));

    if (!isDemoMode && selectedDeviceId) {
        try {
            const currentConv = conversations.find(c => c.id === selectedConvId);
            if(currentConv) {
                await fetch(`${API_BASE_URL}/sessions/${selectedDeviceId}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify({ number: currentConv.phoneNumber, text: inputText })
                });
            }
        } catch(e) {
            console.error("Erro envio API", e);
        }
    }
    setInputText('');
  };

  const handleSmartReply = async () => {
    if (!selectedConvId) return;
    const currentConv = conversations.find(c => c.id === selectedConvId);
    if (!currentConv) return;
    setIsGeminiGenerating(true);
    
    // Simulate or Real
    if (isDemoMode) {
        setTimeout(() => {
            setInputText("Olá! Como posso ajudar com sua dúvida sobre nossos produtos?");
            setIsGeminiGenerating(false);
        }, 1000);
    } else {
        const historyText = currentConv.messages.slice(-5).map(m => `${m.sender === 'user' ? 'Cliente' : 'Atendente'}: ${m.text}`).join('\n');
        const suggestion = await generateSmartReply(historyText);
        setInputText(suggestion);
        setIsGeminiGenerating(false);
    }
  };

  if (isInitializing) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300 gap-4">
            <Loader2 className="animate-spin text-purple-500" size={48} />
            <p className="animate-pulse">Iniciando Sistema...</p>
        </div>
      );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const selectedConversation = conversations.find(c => c.id === selectedConvId);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-purple-500 selection:text-white">
      <StripeModal isOpen={isStripeModalOpen} onClose={() => setIsStripeModalOpen(false)} />
      
      <header className="bg-slate-800 shadow-lg border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-center md:text-left flex items-center gap-3">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">ChatBot Host v2.5</h1>
                <div className="flex gap-4 text-xs">
                    <button onClick={() => setActiveTab('chat')} className={`uppercase tracking-wider hover:text-white ${activeTab === 'chat' ? 'text-white font-bold border-b-2 border-purple-500' : 'text-slate-400'}`}>Dashboard</button>
                    <button onClick={() => setActiveTab('clients')} className={`uppercase tracking-wider hover:text-white ${activeTab === 'clients' ? 'text-white font-bold border-b-2 border-purple-500' : 'text-slate-400'}`}>Gerenciar Clientes</button>
                </div>
            </div>
            {isDemoMode && (
                <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">
                    Modo Simulação
                </span>
            )}
          </div>
          <div className="flex gap-3">
             <button onClick={() => setIsStripeModalOpen(true)} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg ${isSubscribed ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}>
              <CreditCard size={16} /> {isSubscribed ? currentPlanName : 'Assinar'}
            </button>
            <button onClick={handleLogout} className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg transition-colors" title="Sair">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 md:p-6">
        {apiError && !isDemoMode && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg mb-6 flex flex-col md:flex-row items-start gap-3 justify-between">
                <div className="flex gap-3">
                    <ShieldAlert size={24} className="flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold">Erro de Conexão</p>
                        <p className="text-sm opacity-90">{apiError}</p>
                        <p className="text-xs mt-1 opacity-75 font-mono">API: {API_BASE_URL}</p>
                    </div>
                </div>
                <div className="flex gap-2 mt-3 md:mt-0">
                    <button onClick={handleChangeApiUrl} className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded text-white border border-slate-600 flex items-center gap-1"><Settings size={12} /> Alterar URL</button>
                    <button onClick={fetchSessions} className="text-sm bg-red-800 hover:bg-red-700 px-3 py-1 rounded text-white">Reconectar</button>
                </div>
            </div>
        )}

        {activeTab === 'clients' ? (
            <ClientManager isDemo={isDemoMode} />
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
                {/* System Status */}
                <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden">
                <div className="bg-slate-700/50 px-4 py-3 border-b border-slate-700">
                    <h2 className="font-semibold text-white flex items-center gap-2"><Activity size={18} className="text-purple-400"/> Status do Sistema</h2>
                </div>
                <div className="p-5 grid grid-cols-2 gap-4">
                    <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-600 flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${systemStatus.gemini ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
                    <span className="text-sm font-medium">Gemini AI</span>
                    </div>
                    <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-600 flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${systemStatus.websocket ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
                    <div className="flex flex-col"><span className="text-sm font-medium">WebSocket</span><span className="text-xs text-slate-400">{systemStatus.latency}ms</span></div>
                    </div>
                </div>
                </div>

                {/* Devices */}
                <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden">
                <div className="bg-slate-700/50 px-4 py-3 border-b border-slate-700">
                    <h2 className="font-semibold text-white flex items-center gap-2"><Smartphone size={18} className="text-green-400"/> Dispositivos</h2>
                </div>
                <div className="p-5 space-y-4">
                    <div className="flex gap-2">
                    <input type="text" value={newDeviceName} onChange={(e) => setNewDeviceName(e.target.value)} placeholder="Nome (ex: suporte)" className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"/>
                    <button onClick={handleAddDevice} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium"><Plus size={16} /></button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {devices.map(device => (
                        <div key={device.id} onClick={() => setSelectedDeviceId(device.id)} className={`p-3 rounded border flex justify-between items-center cursor-pointer transition-all ${selectedDeviceId === device.id ? 'bg-purple-900/30 border-purple-500' : 'bg-slate-700/40 border-slate-600 hover:bg-slate-700'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${device.status === ConnectionStatus.CONNECTED ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]' : device.status === ConnectionStatus.CONNECTING ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
                            <span className="font-medium text-sm">{device.name}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleRemoveDevice(device.id); }} className="p-1.5 text-slate-400 hover:text-red-400 rounded transition-colors" title="Desconectar"><Trash2 size={14} /></button>
                        </div>
                    ))}
                    {devices.length === 0 && <p className="text-center text-slate-500 text-sm italic">Nenhum dispositivo.</p>}
                    </div>
                </div>
                </div>

                {/* Auth/QR */}
                <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden min-h-[200px] flex flex-col justify-center items-center p-6 text-center relative">
                    <div className="absolute top-3 left-4 text-xs font-bold text-slate-500 uppercase">Status Conexão</div>
                    {selectedDeviceId ? (
                        qrCode && devices.find(d => d.id === selectedDeviceId)?.status === ConnectionStatus.CONNECTING ? (
                            <div className="bg-white p-2 rounded-lg">
                                <img src={qrCode} alt="QR Code" className="w-32 h-32" />
                                <p className="text-slate-900 text-xs mt-2 font-bold">Escaneie agora</p>
                            </div>
                        ) : devices.find(d => d.id === selectedDeviceId)?.status === ConnectionStatus.CONNECTED ? (
                        <>
                            <div className="bg-green-500/10 p-4 rounded-full mb-4 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]"><Wifi size={32} className="text-green-500" /></div>
                            <h3 className="text-xl font-bold text-green-400 flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Conectado</h3>
                            {isDemoMode && <p className="text-slate-500 text-xs mt-2">(Simulação)</p>}
                        </>
                        ) : (
                            <p className="text-slate-500 text-sm">Desconectado / Aguardando QR...</p>
                        )
                    ) : <p className="text-slate-500 text-sm">Selecione um dispositivo</p>}
                </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
                <LogicManager sessionId={selectedDeviceId} isDemo={isDemoMode} />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                    <div className="lg:col-span-1 bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden flex flex-col">
                        <div className="bg-slate-700/50 px-4 py-3 border-b border-slate-700"><h2 className="font-semibold text-white text-sm">Chats (Simulação)</h2></div>
                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                            {conversations.map((conv) => (
                            <div key={conv.id} onClick={() => setSelectedConvId(conv.id)} className={`px-4 py-3 border-b border-slate-700/50 cursor-pointer hover:bg-slate-700/40 transition-colors flex justify-between items-center ${selectedConvId === conv.id ? 'bg-purple-900/20 border-l-4 border-l-purple-500' : ''}`}>
                                <div><div className="font-mono text-slate-200 text-xs font-medium">{conv.phoneNumber}</div><div className="text-xs text-slate-400 truncate max-w-[140px] mt-1">{conv.lastMessage || '...'}</div></div>
                            </div>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden flex flex-col">
                        <div className="bg-slate-700/50 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                            <div className="flex items-center gap-3"><div className="bg-gradient-to-br from-purple-500 to-blue-600 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"><Bot size={16} /></div><div><h3 className="font-bold text-white text-sm">{selectedConversation?.phoneNumber}</h3></div></div>
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto bg-[#0B1120] relative custom-scrollbar">
                            {!selectedConversation ? <div className="h-full flex items-center justify-center text-slate-500">Selecione uma conversa</div> : 
                            <div className="space-y-4">
                                {selectedConversation.messages.map((msg) => (
                                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[80%] rounded-lg px-3 py-2 shadow-md text-sm ${msg.sender === 'user' ? 'bg-slate-700 text-slate-100 rounded-tl-none border border-slate-600' : 'bg-purple-900/40 text-slate-100 rounded-tr-none border border-purple-800/50'}`}>
                                            {msg.text}<div className="text-[10px] opacity-50 mt-1 text-right">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                            }
                            <div className="absolute bottom-4 right-4"><button onClick={handleSmartReply} disabled={isGeminiGenerating} className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"><Sparkles size={12} />{isGeminiGenerating ? 'Gerando...' : 'Sugestão IA'}</button></div>
                        </div>
                        <div className="p-3 bg-slate-800 border-t border-slate-700">
                            <div className="flex gap-2">
                                <div className="flex-1 relative"><input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Digite..." className="w-full bg-slate-900 border border-slate-600 text-slate-100 rounded-lg py-2 pl-3 pr-10 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 placeholder-slate-500"/></div>
                                <button onClick={handleSendMessage} className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"><Bot size={18} /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        )}
      </main>
    </div>
  );
}

export default App;
