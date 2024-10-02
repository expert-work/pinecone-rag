'use client'

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, supabase } from '@/app/lib/auth-client';
import { DBMessage, Message, Chat } from '@/types/chat';
import { User } from '@supabase/supabase-js';
import { useChat } from 'ai/react';
import { v4 as uuidv4 } from 'uuid';
import { PlusIcon, PaperAirplaneIcon, ChatBubbleLeftIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

const CHATS_PER_PAGE = 10;

const ChatBot = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [lastChatId, setLastChatId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { messages, input, handleInputChange, handleSubmit, setMessages, isLoading } = useChat({
    api: '/api/chat',
    headers: user ? { 'X-User-Id': user.id } : undefined,
    body: { userId: user?.id, chatId: currentChatId },
    onFinish: async (message) => {
      if (currentChatId && user) {
        await saveMessageToSupabase(currentChatId, convertVercelMessage(message));
        await updateChatList();
      }
    },
  });

  useEffect(() => {
    const checkUser = async () => {
      console.log('Checking user...');
      const currentUser = await getUser();
      if (currentUser) {
        console.log('User found:', currentUser);
        setUser(currentUser);
      } else {
        console.log('No user found, redirecting to login');
        router.push('/login');
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      console.log('Auth state changed:', event);
      if (event === 'SIGNED_IN') {
        checkUser();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        router.push('/login');
      }
    });

    checkUser();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchChats();
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchChats = useCallback(async () => {
    if (!user) {
      console.log('No user, cannot fetch chats');
      return;
    }
    console.log('Fetching chats for user:', user.id);
    try {
      let query = supabase
        .from('Chat')
        .select(`
          id,
          userId,
          createdAt,
          Message (
            id,
            content,
            role,
            createdAt,
            chatId
          )
        `)
        .eq('userId', user.id)
        .order('createdAt', { ascending: false })
        .limit(CHATS_PER_PAGE);

      if (lastChatId) {
        query = query.lt('id', lastChatId);
      }

      const { data, error } = await query;

      if (error) throw error;
      console.log('Fetched chats:', data);
      
      if (data && data.length > 0) {
        setChats(prevChats => {
          const uniqueChats = new Set(prevChats.map(chat => chat.id));
          const newChats = (data as Chat[])
            .filter(chat => !uniqueChats.has(chat.id))
            .map(chat => ({
              ...chat,
              Message: Array.isArray(chat.Message) ? chat.Message : []
            }));
          return [...prevChats, ...newChats];
        });
        setLastChatId(data[data.length - 1].id);
        setHasMore(data.length === CHATS_PER_PAGE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  }, [user, lastChatId]);

  const loadMoreChats = useCallback(() => {
    if (hasMore) {
      fetchChats();
    }
  }, [hasMore, fetchChats]);

  useEffect(() => {
    const chatList = chatListRef.current;
    if (chatList) {
      const handleScroll = () => {
        if (
          chatList.scrollTop + chatList.clientHeight >= chatList.scrollHeight - 20 &&
          hasMore
        ) {
          loadMoreChats();
        }
      };

      chatList.addEventListener('scroll', handleScroll);
      return () => chatList.removeEventListener('scroll', handleScroll);
    }
  }, [loadMoreChats, hasMore]);

  const getChatTitle = (chat: Chat): string => {
    if (!chat.Message || chat.Message.length === 0) {
      return `New Chat ${chat.id.slice(0, 8)}...`;
    }
    const firstUserMessage = chat.Message.find(m => m.role === 'user');
    if (firstUserMessage) {
      return firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '');
    }
    return `Chat ${chat.id.slice(0, 8)}...`;
  };

  const loadChat = (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      setCurrentChatId(chatId);
      setMessages(chat.Message.map(m => ({
        id: m.id || uuidv4(),
        role: m.role as Message['role'],
        content: m.content,
      })));
    }
  };

  const createNewChat = async () => {
    if (!user) return null;
    console.log('Creating new chat for user:', user.id);
    try {
      const newChatId = uuidv4();
      const newChat = {
        id: newChatId,
        userId: user.id,
      };
      const { data, error } = await supabase
        .from('Chat')
        .insert(newChat)
        .select()
        .single();

      if (error) throw error;
      console.log('Created new chat:', data);
      setCurrentChatId(newChatId);
      setMessages([]);
      setChats(prevChats => [{...data as Chat, Message: []}, ...prevChats]);
      return newChatId;
    } catch (error) {
      console.error('Error creating new chat:', error);
      return null;
    }
  };

  const convertVercelMessage = (vercelMessage: Message): DBMessage => {
    let role: 'user' | 'assistant' | 'system';
    
    switch (vercelMessage.role) {
      case 'user':
      case 'assistant':
      case 'system':
        role = vercelMessage.role;
        break;
      case 'function':
      case 'data':
      case 'tool':
        role = 'system';  // Map these roles to 'system'
        break;
      default:
        console.warn(`Unknown message role: ${vercelMessage.role}`);
        role = 'system';  // Default to 'system' for unknown roles
    }

    return {
      role: role,
      content: vercelMessage.content,
    };
  };

  const saveMessageToSupabase = async (chatId: string, message: DBMessage) => {
    console.log('Saving message to Supabase:', message);
    try {
      const { data, error } = await supabase
        .from('Message')
        .insert({
          chatId: chatId,
          role: message.role,
          content: message.content,
        })
        .select()
        .single();

      if (error) throw error;

      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === chatId 
            ? { 
                ...chat, 
                Message: [...(chat.Message || []), data as DBMessage]
              }
            : chat
        )
      );
    } catch (error) {
      console.error('Error saving message to Supabase:', error);
    }
  };

  const updateChatList = async () => {
    if (currentChatId) {
      const { data, error } = await supabase
        .from('Chat')
        .select(`
          id,
          userId,
          createdAt,
          Message (
            id,
            content,
            role,
            createdAt,
            chatId
          )
        `)
        .eq('id', currentChatId)
        .single();

      if (error) {
        console.error('Error fetching updated chat:', error);
        return;
      }

      setChats(prevChats => {
        const updatedChats = prevChats.filter(chat => chat.id !== currentChatId);
        return [data as Chat, ...updatedChats];
      });
    }
  };

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    let chatId = currentChatId;
    
    if (!chatId) {
      const newChatId = await createNewChat();
      if (newChatId) {
        chatId = newChatId;
        setCurrentChatId(newChatId);
      } else {
        console.error('Failed to create new chat');
        return;
      }
    }
    
    if (chatId) {
      await saveMessageToSupabase(chatId, {
        role: 'user',
        content: input,
      });
      
      await handleSubmit(e);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen bg-white text-black">
      {/* Mobile sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="md:hidden fixed top-4 left-4 z-20 p-2 bg-black text-white rounded-full"
      >
        <ChatBubbleLeftIcon className="w-6 h-6" />
      </button>

      {/* Chat history sidebar */}
      <div 
        ref={chatListRef}
        className={`${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:static inset-y-0 left-0 w-64 md:w-80 bg-gray-50 p-4 overflow-y-auto border-r border-gray-200 shadow-lg transition-transform duration-300 ease-in-out z-10 flex flex-col`}
      >
        <button
          onClick={createNewChat}
          className="w-full p-3 mb-6 bg-black text-white rounded-lg hover:bg-gray-800 transition-all duration-200 ease-in-out flex items-center justify-center space-x-2 shadow-md"
        >
          <PlusIcon className="w-5 h-5" />
          <span>New Chat</span>
        </button>
        <div className="flex-grow">
          {chats.length === 0 ? (
            <p className="text-gray-500 italic text-center">No chats available</p>
          ) : (
            <div className="space-y-2">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => {
                    loadChat(chat.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`p-3 cursor-pointer rounded-lg transition-all duration-200 ease-in-out ${
                    chat.id === currentChatId 
                      ? 'bg-gray-200 shadow-inner' 
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {getChatTitle(chat)}
                </div>
              ))}
            </div>
          )}
          {hasMore && (
            <button 
              onClick={loadMoreChats}
              className="w-full p-2 mt-4 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-all duration-200 ease-in-out"
            >
              Load More
            </button>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="w-full p-3 mt-6 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-all duration-200 ease-in-out flex items-center justify-center space-x-2"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[70%] p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-black text-white rounded-br-none' 
                  : 'bg-gray-100 text-black rounded-bl-none'
              }`}>
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-black rounded-lg rounded-bl-none p-3 max-w-[85%] md:max-w-[70%]">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition-all duration-200 ease-in-out"
              placeholder="Type your message..."
            />
            <button 
              type="submit" 
              className="p-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatBot;