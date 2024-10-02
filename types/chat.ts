import { Message as VercelMessage } from 'ai';

export interface DBMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  chatId?: string;
  createdAt?: string;
}

export type Message = VercelMessage;

export interface Chat {
  id: string;
  userId: string;
  createdAt?: string;
  Message: DBMessage[];
}

export interface User {
  id: string;
  email: string;
}

export function isDBMessage(message: unknown): message is DBMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'role' in message &&
    'content' in message &&
    typeof (message as DBMessage).role === 'string' &&
    typeof (message as DBMessage).content === 'string' &&
    ['user', 'assistant', 'system'].includes((message as DBMessage).role)
  );
}

export function isMessage(message: unknown): message is Message {
  return (
    typeof message === 'object' &&
    message !== null &&
    'id' in message &&
    'role' in message &&
    'content' in message &&
    typeof (message as Message).id === 'string' &&
    typeof (message as Message).role === 'string' &&
    typeof (message as Message).content === 'string'
  );
}