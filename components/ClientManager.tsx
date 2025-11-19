
import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, User, Mail, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../constants';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface ClientManagerProps {
    isDemo?: boolean;
}

export const ClientManager: React.FC<ClientManagerProps> = ({ isDemo }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('client');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) {
        setUsers([
            { id: 1, name: 'Cliente Exemplo', email: 'cliente@exemplo.com', role: 'client' },
            { id: 2, name: 'Admin Demo', email: 'admin@demo.com', role: 'admin' }
        ]);
    } else {
        fetchUsers();
    }
  }, [isDemo]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        setError(null);
      } else {
        throw new Error(`HTTP Error ${res.status}`);
      }
    } catch (error) {
      console.error("Erro ao buscar usuários", error);
      setError("Erro ao carregar clientes. Verifique a conexão.");
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    if (isDemo) {
        const newUser = { id: Date.now(), name, email, role };
        setUsers([...users, newUser]);
        setName('');
        setEmail('');
        setIsLoading(false);
        return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, email, role })
      });
      
      if (res.ok) {
        fetchUsers();
        setName('');
        setEmail('');
      } else {
        setError("Erro ao adicionar usuário. Tente novamente.");
      }
    } catch (error) {
      console.error("Erro add user", error);
      setError("Erro de conexão ao adicionar usuário.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Remover usuário?')) return;
    
    if (isDemo) {
        setUsers(users.filter(u => u.id !== id));
        return;
    }

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchUsers();
    } catch (error) {
      console.error("Erro delete user", error);
      alert("Erro ao deletar usuário");
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden flex flex-col h-[600px]">
      <div className="bg-slate-700/50 px-4 py-3 border-b border-slate-700">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Users size={18} className="text-blue-400"/> Gestão de Clientes
        </h2>
      </div>

      <div className="p-6 flex flex-col h-full">
        <form onSubmit={handleAddUser} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mb-6">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Plus size={16} /> Novo Cadastro
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input 
              type="text" 
              placeholder="Nome do Cliente" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
              required
            />
            <input 
              type="email" 
              placeholder="Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
              required
            />
            <div className="flex gap-2">
                <select 
                    value={role} 
                    onChange={(e) => setRole(e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none flex-1"
                >
                    <option value="client">Cliente</option>
                    <option value="admin">Admin</option>
                </select>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? '...' : 'Adicionar'}
                </button>
            </div>
          </div>
        </form>

        {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-200 text-sm flex items-center gap-2">
                <AlertCircle size={16} /> {error}
            </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="space-y-2">
                {users.map(user => (
                    <div key={user.id} className="flex items-center justify-between bg-slate-700/30 p-3 rounded border border-slate-600 hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="bg-slate-600 p-2 rounded-full">
                                <User size={16} className="text-slate-300" />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-white">{user.name}</div>
                                <div className="text-xs text-slate-400 flex items-center gap-1">
                                    <Mail size={10} /> {user.email} 
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] uppercase ${user.role === 'admin' ? 'bg-purple-900 text-purple-200' : 'bg-blue-900 text-blue-200'}`}>
                                        {user.role}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                            title="Remover Cliente"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
                {users.length === 0 && !error && <p className="text-center text-slate-500 mt-10">Nenhum cliente cadastrado.</p>}
            </div>
        </div>
      </div>
    </div>
  );
};
