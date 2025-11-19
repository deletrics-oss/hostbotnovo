export enum ConnectionStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING'
}

export interface Device {
  id: string;
  name: string;
  status: ConnectionStatus;
  phoneNumber: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  phoneNumber: string;
  lastMessage: string;
  messages: Message[];
  unreadCount: number;
}

export interface SystemStatus {
  gemini: boolean;
  websocket: boolean;
  latency: number;
}