import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, Loader2, Sparkles, Languages, HelpCircle, Minimize2, Maximize2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { getErrorMessage } from '../services/api';
const AIChatModal = ({ isOpen, onClose, contextData = {} }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showQuickHelp, setShowQuickHelp] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Quick help suggestions
  const quickSuggestions = [
    { text: "How do I assign faculty?", emoji: "👨‍🏫" },
    { text: "What's causing this conflict?", emoji: "⚠️" },
    { text: "Paano mag-schedule?", emoji: "🇵🇭" },
    { text: "Show available time slots", emoji: "📅" },
    { text: "Explain this error", emoji: "❓" },
  ];

  // Greeting message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: `👋 Hello! I'm your **AI Scheduling Assistant**.\n\nI can help you with:\n- 📅 Schedule planning and conflicts\n- 👨‍🏫 Faculty assignments\n- 🏫 Room bookings\n- 🌐 Multilingual support\n\nHow can I assist you today?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const sendMessage = async (messageText = inputMessage) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setShowQuickHelp(false);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: messageText,
          conversationHistory: messages
            .filter(m => m.role === 'user' || (m.role === 'assistant' && !m.content.includes('👋 Hello'))) // Exclude greeting
            .map(m => ({
              role: m.role,
              content: m.content,
            })),
          includeContext: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage = {
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          metadata: data.metadata,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(data.message || 'Failed to get response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error(getErrorMessage(error, 'Failed to send message'));
      
      const errorMessage = {
        role: 'assistant',
        content: '❌ Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleQuickSuggestion = (suggestion) => {
    sendMessage(suggestion);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      {/* Backdrop for mobile */}
      {!isMinimized && (
        <div 
          className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto md:hidden"
          onClick={onClose}
        />
      )}

      {/* Chat window */}
      <div 
        className={`relative pointer-events-auto transition-all duration-300 ${
          isMinimized 
            ? 'w-80 h-16' 
            : 'w-full md:w-96 h-[600px]'
        } max-w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bot className="w-6 h-6" />
              <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm">AI Assistant</h3>
              {!isMinimized && (
                <p className="text-xs opacity-90 flex items-center gap-1">
                  <Languages className="w-3 h-3" />
                  Multilingual Support
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title={isMinimized ? 'Maximize' : 'Minimize'}
            >
              {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : msg.isError
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {msg.content.split('\n').map((line, i) => {
                        // Parse markdown-style bold
                        const parts = line.split(/(\*\*.*?\*\*)/g);
                        return (
                          <p key={i} className={i > 0 ? 'mt-2' : ''}>
                            {parts.map((part, j) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={j}>{part.slice(2, -2)}</strong>;
                              }
                              return <span key={j}>{part}</span>;
                            })}
                          </p>
                        );
                      })}
                    </div>
                    <p className={`text-[10px] mt-1 opacity-60 ${msg.role === 'user' ? 'text-white' : 'text-gray-500'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick suggestions */}
            {showQuickHelp && messages.length === 1 && (
              <div className="px-4 py-3 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Quick suggestions:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {quickSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickSuggestion(suggestion.text)}
                      className="text-xs px-3 py-1.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-full transition-colors flex items-center gap-1.5"
                    >
                      <span>{suggestion.emoji}</span>
                      <span className="text-gray-700 dark:text-gray-300">{suggestion.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message... (支持多语言)"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
                Powered by Gemini 1.5 Flash · Press Enter to send
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AIChatModal;
