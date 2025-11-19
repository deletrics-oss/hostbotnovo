
import { Device, Conversation, ConnectionStatus } from './types';

// --- API URL Configuration ---
// 1. Check for user manual override in localStorage
// 2. If localhost/preview, use the explicit Server IP (Port 3034)
// 3. If production (deployed on same server), use relative path '/api'
const isLocalEnv = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname.includes('stackblitz') || 
    window.location.hostname.includes('google')
);

// ATENÇÃO: URL Externa do seu servidor VPS
const REMOTE_SERVER_URL = 'http://72.60.246.250:3034/api'; 

export const API_BASE_URL = 
    (typeof window !== 'undefined' && localStorage.getItem('custom_api_url')) || 
    (isLocalEnv ? REMOTE_SERVER_URL : '/api');

export const INITIAL_DEVICES: Device[] = [];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    phoneNumber: '5511999999999',
    lastMessage: 'Bem-vindo ao ChatBot Host!',
    unreadCount: 1,
    messages: [
      { id: 'm1', sender: 'bot', text: 'Sistema iniciado.', timestamp: new Date() }
    ]
  }
];

export const STRIPE_PLANS = [
  { name: 'Basic', price: 'R$ 97,00/mês', features: [] }
];

export const LOGIC_TEMPLATE_JSON = `{
  "default_reply": "Desculpe, não entendi. Digite MENU.",
  "rules": [
    {
      "keywords": ["oi", "ola", "menu"],
      "reply": "Olá! Escolha:\\n1. Comprar\\n2. Suporte",
      "pause_bot_after_reply": false
    },
    {
      "keywords": ["humano", "atendente"],
      "reply": "Chamando suporte...",
      "pause_bot_after_reply": true
    }
  ]
}`;

export const LOGIC_TEMPLATE_TXT = `
EMPRESA: Minha Loja
HORÁRIO: 08h às 18h

PRODUTOS:
- Item A: R$ 50
- Item B: R$ 100

POLÍTICA DE TROCA:
7 dias para devolução.
`;
