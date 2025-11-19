import React, { useState } from 'react';
import { Lock, User, AlertTriangle, Settings, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../constants';
import { StripeModal } from './StripeModal';
import { authService } from '../services/authService';

interface LoginScreenProps {
  onLogin: (demo?: boolean) => void;
}

type AuthView = 'login' | 'plans' | 'register';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [view, setView] = useState<AuthView>('login');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customUrl, setCustomUrl] = useState(API_BASE_URL);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
        const data = await authService.login(username, password);
        if (data.success) {
            if (data.token) {
                localStorage.setItem('token', data.token);
            }
            onLogin(false);
        } else {
            setError(data.message || 'Erro no login');
        }
    } catch (err: any) {
        console.error("Login error", err);
        setError(err.message || 'Erro ao conectar. Tente novamente.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsLoading(true);

      try {
          const data = await authService.register(regName, regEmail, regPassword, selectedPlan);
          if (data.token) {
              localStorage.setItem('token', data.token);
          }
          // If successful (Firebase or API), log in
          onLogin(false);
      } catch (err: any) {
          setError(err.message || "Erro ao criar conta.");
      } finally {
          setIsLoading(false);
      }
  };

  const handlePlanSelect = (plan: any) => {
      setSelectedPlan(plan);
      setView('register');
      setError('');
  };

  const handleSaveSettings = () => {
      if (customUrl) {
          localStorage.setItem('custom_api_url', customUrl);
          window.location.reload();
      }
  };

  const handleResetSettings = () => {
      localStorage.removeItem('custom_api_url');
      window.location.reload();
  };

  if (showSettings) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
            <div className="bg-slate-800 p-8 rounded-lg shadow-2xl w-full max-w-md border border-slate-700">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Settings /> Configurar Servidor</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">URL da API</label>
                        <input 
                            type="text" 
                            value={customUrl} 
                            onChange={(e) => setCustomUrl(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                        />
                        <p className="text-xs text-slate-400 mt-2">Padrão: http://72.60.246.250:3033/api</p>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button onClick={handleSaveSettings} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium">Salvar e Recarregar</button>
                        <button onClick={() => setShowSettings(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded">Voltar</button>
                    </div>
                    <button onClick={handleResetSettings} className="w-full text-xs text-red-400 hover:text-red-300 mt-4 underline">Restaurar Padrão</button>
                </div>
            </div>
        </div>
      );
  }

  // --- VIEWS ---

  // 1. PLANS VIEW
  if (view === 'plans') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-4">
            <div className="w-full max-w-5xl">
                <button onClick={() => setView('login')} className="mb-4 text-slate-400 hover:text-white flex items-center gap-2">
                    <ArrowLeft size={20} /> Voltar para Login
                </button>
                <h1 className="text-3xl font-bold text-white text-center mb-2">Escolha seu Plano</h1>
                <p className="text-slate-400 text-center mb-8">Para começar, selecione a melhor opção para o seu negócio.</p>
                
                {/* Reuse StripeModal content logic but inline */}
                <StripeModal isOpen={true} onClose={() => {}} onSelectPlan={handlePlanSelect} inline={true} />
            </div>
        </div>
      );
  }

  // 2. REGISTER VIEW
  if (view === 'register') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
            <div className="bg-slate-800 p-8 rounded-lg shadow-2xl w-full max-w-md border border-slate-700 relative">
                <button onClick={() => setView('plans')} className="absolute top-4 left-4 text-slate-400 hover:text-white">
                    <ArrowLeft size={20} />
                </button>
                
                <h2 className="text-2xl font-bold text-white text-center mb-1">Criar Conta</h2>
                <div className="text-center mb-6">
                    <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-1 rounded border border-purple-500/30">
                        Plano Selecionado: {selectedPlan?.name}
                    </span>
                </div>

                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Nome Completo</label>
                        <div className="relative">
                            <User className="absolute top-2.5 left-3 h-5 w-5 text-slate-500" />
                            <input
                                type="text"
                                value={regName}
                                onChange={(e) => setRegName(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Seu nome"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute top-2.5 left-3 h-5 w-5 text-slate-500" />
                            <input
                                type="email"
                                value={regEmail}
                                onChange={(e) => setRegEmail(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="seu@email.com"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Senha</label>
                        <div className="relative">
                            <Lock className="absolute top-2.5 left-3 h-5 w-5 text-slate-500" />
                            <input
                                type="password"
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded flex items-center gap-2">
                            <AlertTriangle size={16} /> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50 mt-4"
                    >
                        {isLoading ? 'Criando conta...' : 'Finalizar Cadastro'}
                    </button>
                </form>
            </div>
        </div>
      );
  }

  // 3. LOGIN VIEW (Default)
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-slate-800 p-8 rounded-lg shadow-2xl w-full max-w-md border border-slate-700 relative">
        <button 
            onClick={() => setShowSettings(true)}
            className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            title="Configurações de Conexão"
        >
            <Settings size={20} />
        </button>

        <h1 className="text-3xl font-bold text-white text-center mb-2">ChatBot Host v2.5</h1>
        <p className="text-slate-400 text-center mb-8">Gestão Inteligente de WhatsApp</p>
        
        <form onSubmit={handleLoginSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Usuário / Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-600 rounded-md leading-5 bg-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="admin"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-600 rounded-md leading-5 bg-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-900/20 p-3 rounded flex flex-col items-center justify-center gap-2">
              <div className="flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>
              <button type="button" onClick={() => setShowSettings(true)} className="text-xs underline hover:text-red-300">Configurar Servidor</button>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>

           <button
            type="button"
            onClick={() => onLogin(true)}
            className="w-full flex justify-center py-2 px-4 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-transparent hover:bg-slate-700 focus:outline-none transition-colors"
          >
            Entrar (Modo Teste)
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-700 text-center">
            <p className="text-slate-400 text-sm mb-3">Ainda não tem uma conta?</p>
            <button 
                onClick={() => setView('plans')}
                className="text-green-400 hover:text-green-300 font-medium text-sm border border-green-500/30 bg-green-500/10 px-4 py-2 rounded hover:bg-green-500/20 transition-all w-full"
            >
                Começar Agora
            </button>
        </div>
      </div>
    </div>
  );
};