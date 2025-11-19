
import { Device, Conversation, ConnectionStatus } from './types';

// Logic to determine the API URL
// 1. Check localStorage for user override
// 2. If running on localhost/preview, try to hit the hardcoded IP
// 3. Default to relative path '/api' for production
const isLocalOrPreview = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname.includes('google') || window.location.hostname.includes('stackblitz') || window.location.hostname.includes('webcontainer'));

const DEFAULT_API_URL = 'http://72.60.246.250:3033/api';

export const API_BASE_URL = (typeof window !== 'undefined' && localStorage.getItem('custom_api_url')) 
  || (isLocalOrPreview ? DEFAULT_API_URL : '/api');

export const INITIAL_DEVICES: Device[] = [];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    phoneNumber: '5511977197762',
    lastMessage: 'Olá, gostaria de saber o preço.',
    unreadCount: 2,
    messages: [
      { id: 'm1', sender: 'user', text: 'Bom dia', timestamp: new Date(Date.now() - 100000) },
      { id: 'm2', sender: 'bot', text: 'Olá! Bem-vindo à Happy Diversões. Como posso ajudar?', timestamp: new Date(Date.now() - 90000) },
      { id: 'm3', sender: 'user', text: 'Gostaria de saber o preço.', timestamp: new Date(Date.now() - 80000) }
    ]
  }
];

export const STRIPE_PLANS = [
  {
    name: 'Basic',
    price: 'R$ 97,00/mês',
    features: ['1 Dispositivo WhatsApp', 'Chatbot Básico', 'Suporte por Email']
  }
];

export const LOGIC_TEMPLATE_JSON = `{
  "default_reply": "Não entendi. Digite MENU.",
  "rules": [
    {
      "keywords": ["preço", "valor", "quanto"],
      "reply": "O valor é R$ 100,00.",
      "pause_bot_after_reply": false
    },
    {
      "keywords": ["atendente", "humano"],
      "reply": "Chamando um humano...",
      "pause_bot_after_reply": true
    }
  ]
}`;

export const LOGIC_TEMPLATE_TXT = `
EMPRESA: TechSolutions
HORÁRIO: Seg-Sex das 9h às 18h
PRODUTOS:
- Consultoria TI: R$ 200/hora
- Suporte Mensal: R$ 1500/mês

Se o cliente perguntar sobre descontos, diga que temos 10% à vista.
`;
