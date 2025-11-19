import { Device, Conversation, ConnectionStatus } from './types';

// AUTOMATIC API URL DETECTION
// In production (after 'npm run build'), this will use relative path '/api'
// This avoids CORS issues and HTTPS/HTTP mixed content errors entirely.
const isDevelopment = (import.meta as any).env.DEV;
export const API_BASE_URL = isDevelopment 
    ? (localStorage.getItem('custom_api_url') || 'http://localhost:3034/api') 
    : '/api';

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