'use client'

import React, { useState, useEffect, useRef } from 'react';
import { useChat, Message } from 'ai/react';
import JobDetails from './JobDetails';
import { useRouter } from 'next/navigation';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

interface Chat {
  id: string;
  messages: Message[];
}

interface Job {
  title: string;
  description: string;
  industry: string;
  job_location_address_locality: string;
  job_location_address_region: string;
  base_salary_value: number;
  base_salary_term: string;
  employment_type: string;
  experience_requirements: string;
  education_requirements: string;
}

const ChatBot: React.FC = () => {
  const { messages, append, setMessages, isLoading: isAIProcessing } = useChat();
  const [isAITyping, setIsAITyping] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabaseClient = useSupabaseClient();
  const user = useUser();

  useEffect(() => {
    if (user) {
      fetchChats();
      setIsPageLoaded(true);
    } else {
      router.push('/login');
    }
  }, [user, router]);

  useEffect(() => {
    if (isPageLoaded && user && !isInitialized) {
      initializeChat();
    }
  }, [isPageLoaded, user, chats, isInitialized]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isAIProcessing) {
      setIsAITyping(false);
      const typingTimeout = setTimeout(() => setIsAITyping(true), 1000); // Assume AI starts typing after 1 second
      return () => clearTimeout(typingTimeout);
    } else {
      setIsAITyping(false);
    }
  }, [isAIProcessing]);

  const initializeChat = async () => {
    setIsLoading(true);
    const sessionChatId = sessionStorage.getItem('currentChatId');
    if (sessionChatId) {
      try {
        await loadChat(sessionChatId);
      } catch (error) {
        console.error('Error loading chat:', error);
        await createAndSetNewChat();
      }
    } else if (chats.length > 0) {
      const newChatId = chats[0].id;
      setCurrentChatId(newChatId);
      sessionStorage.setItem('currentChatId', newChatId);
      await loadChat(newChatId);
    } else {
      await createAndSetNewChat();
    }
    setIsInitialized(true);
    setIsLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchChats = async () => {
    try {
      const response = await fetch('/api/chats');
      if (!response.ok) throw new Error('Failed to fetch chats');
      const data = await response.json();
      setChats(data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  };

  const loadChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Chat not found');
        }
        throw new Error('Failed to fetch chat messages');
      }
      const data = await response.json();
      setCurrentChatId(chatId);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error loading chat:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('message') as HTMLInputElement;
    const message = input.value.trim();

    if (!message) return;

    if (!currentChatId) {
      const newChatId = await createAndSetNewChat();
      if (!newChatId) {
        console.error('Failed to create a new chat. Please try again.');
        return;
      }
    }

    input.value = '';

    await append({
      content: message,
      role: 'user',
    }, {
      options: {
        body: {
          chatId: currentChatId,
        },
      },
    });

    const lastAssistantMessage = messages[messages.length - 1];
    if (lastAssistantMessage && lastAssistantMessage.role === 'assistant' && lastAssistantMessage.content.includes('Job Title:')) {
      const jobDetails = parseJobDetails(lastAssistantMessage.content);
      setSelectedJob(jobDetails);
    } else {
      setSelectedJob(null);
    }

    await updateChat(currentChatId!, messages);
  };

  const updateChat = async (chatId: string, messages: Message[]) => {
    try {
      await saveMessages(chatId, messages);
      fetchChats(); // Refresh the chat list after updating
    } catch (error) {
      console.error('Error updating chat:', error);
    }
  };

  const saveMessages = async (chatId: string, messages: Message[]) => {
    for (const message of messages) {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveMessage',
          data: { role: message.role, content: message.content, chatId },
        }),
      });
    }
  };

  const parseJobDetails = (content: string): Job => {
    const lines = content.split('\n');
    const jobDetails: Partial<Job> = {};

    lines.forEach(line => {
      const [key, value] = line.split(':').map(s => s.trim());
      switch (key) {
        case 'Job Title':
          jobDetails.title = value;
          break;
        case 'Description':
          jobDetails.description = value;
          break;
        case 'Industry':
          jobDetails.industry = value;
          break;
        case 'Location':
          const [locality, region] = value.split(',').map(s => s.trim());
          jobDetails.job_location_address_locality = locality;
          jobDetails.job_location_address_region = region;
          break;
        case 'Salary':
          const [amount, term] = value.split('per').map(s => s.trim());
          jobDetails.base_salary_value = parseFloat(amount.replace('$', ''));
          jobDetails.base_salary_term = term;
          break;
        case 'Employment Type':
          jobDetails.employment_type = value;
          break;
        case 'Experience Required':
          jobDetails.experience_requirements = value;
          break;
        case 'Education':
          jobDetails.education_requirements = value;
          break;
      }
    });

    return jobDetails as Job;
  };

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    router.push('/login');
  };

  const createAndSetNewChat = async () => {
    try {
      const response = await fetch('/api/chats', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ forceNew: true })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response from server:', errorData);
        throw new Error(`Failed to create a new chat: ${response.status} ${response.statusText}`);
      }

      const newChat = await response.json();
      setCurrentChatId(newChat.id);
      sessionStorage.setItem('currentChatId', newChat.id);
      setMessages([]);
      setSelectedJob(null);
      await fetchChats(); // Refresh the chat list
      return newChat.id;
    } catch (error) {
      console.error('Error creating new chat:', error);
      setCurrentChatId(null);
      sessionStorage.removeItem('currentChatId');
      return null;
    }
  };

  const startNewConversation = async () => {
    setIsLoading(true);
    try {
      // Delete empty chats
      const deleteResponse = await fetch('/api/chats', { method: 'DELETE' });
      if (!deleteResponse.ok) {
        console.error('Failed to delete empty chats');
      } else {
        const deleteData = await deleteResponse.json();
        console.log(`Deleted ${deleteData.deletedCount} empty chats`);
      }

      // Create new chat
      await createAndSetNewChat();
    } catch (error) {
      console.error('Error starting new conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectChat = async (chat: Chat) => {
    setCurrentChatId(chat.id);
    sessionStorage.setItem('currentChatId', chat.id);
    await loadChat(chat.id);
    setSelectedJob(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="inline-block p-4 rounded-lg bg-gray-200 animate-pulse">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className="w-64 bg-gray-100 text-black p-4 overflow-y-auto border-r border-gray-300">
        <h2 className="text-xl font-bold mb-4">Conversations</h2>
        <button
          onClick={startNewConversation}
          className="w-full p-2 mb-4 bg-black text-white rounded hover:bg-gray-800 transition-colors"
        >
          New Conversation
        </button>
        {chats.map(chat => (
          <div
            key={chat.id}
            className={`p-2 hover:bg-gray-200 cursor-pointer rounded transition-colors ${chat.id === currentChatId ? 'bg-gray-300' : ''}`}
            onClick={() => selectChat(chat)}
          >
            {chat.messages[0]?.content.substring(0, 30)}...
          </div>
        ))}
        <button
          onClick={handleLogout}
          className="w-full p-2 mt-4 bg-gray-300 text-black rounded hover:bg-gray-400 transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          {messages.map((message, index) => (
            <div key={index} className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block p-2 rounded-lg ${message.role === 'user' ? 'bg-black text-white' : 'bg-gray-200 text-black'}`}>
                {message.content}
              </div>
            </div>
          ))}
          {isAIProcessing && (
            <div className="text-left mb-4">
              <div className="inline-block p-2 rounded-lg bg-gray-200 animate-pulse">
                {isAITyping ? 'AI is typing...' : 'AI is thinking...'}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-4 bg-gray-100 border-t border-gray-300">
          <div className="flex">
            <input
              type="text"
              name="message"
              placeholder="Type your message..."
              className="flex-1 p-2 rounded-l-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            <button 
              type="submit" 
              className="px-4 rounded-r-lg bg-black text-white font-bold p-2 uppercase border-black hover:bg-gray-800 transition-colors"
              disabled={isAIProcessing}
            >
              {isAIProcessing ? 'Wait...' : 'Send'}
            </button>
          </div>
        </form>
      </div>

      {/* Job details sidebar */}
      {selectedJob && (
        <div className="w-1/3 p-4 bg-white border-l border-gray-300 overflow-y-auto">
          <JobDetails job={selectedJob} />
        </div>
      )}
    </div>
  );
};

export default ChatBot;