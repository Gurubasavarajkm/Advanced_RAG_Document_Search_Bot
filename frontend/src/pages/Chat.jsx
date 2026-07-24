import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { askQuery } from '../api';
import ReactMarkdown from 'react-markdown';
import '../components/ui.css';

const Chat = () => {
  const { token } = useAuth();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am Document Search Bot. Ask me any question about the uploaded documents.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!token) return <Navigate to="/" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userQuery = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userQuery }]);
    setIsLoading(true);

    try {
      const response = await askQuery(userQuery);
      setMessages(prev => [...prev, { role: 'assistant', content: response.answer }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error while processing your request.',
        isError: true 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
      
      {/* Header */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--surface-border)', background: 'rgba(15, 23, 42, 0.4)' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot color="var(--primary-color)" /> Document Search Bot Assistant
        </h2>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Ask questions based on your knowledge base.</p>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ 
            display: 'flex', 
            gap: '1rem',
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%'
          }}>
            {msg.role === 'assistant' && (
              <div style={{ 
                width: '36px', height: '36px', borderRadius: '50%', 
                background: 'rgba(139, 92, 246, 0.2)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
              }}>
                <Bot size={20} color="var(--primary-color)" />
              </div>
            )}
            
            <div style={{
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-lg)',
              background: msg.role === 'user' ? 'var(--primary-color)' : 'rgba(30, 41, 59, 0.8)',
              border: msg.role === 'assistant' ? '1px solid var(--surface-border)' : 'none',
              color: msg.isError ? 'var(--danger-color)' : 'white',
              boxShadow: msg.role === 'user' ? '0 4px 14px 0 rgba(139, 92, 246, 0.2)' : 'none'
            }}>
              {msg.role === 'assistant' ? (
                 <div className="markdown-body">
                   <ReactMarkdown>{msg.content}</ReactMarkdown>
                 </div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{msg.content}</div>
              )}
            </div>

            {msg.role === 'user' && (
              <div style={{ 
                width: '36px', height: '36px', borderRadius: '50%', 
                background: 'rgba(255, 255, 255, 0.1)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
              }}>
                <User size={20} />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', gap: '1rem', alignSelf: 'flex-start' }}>
            <div style={{ 
              width: '36px', height: '36px', borderRadius: '50%', 
              background: 'rgba(139, 92, 246, 0.2)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center' 
            }}>
              <Bot size={20} color="var(--primary-color)" />
            </div>
            <div style={{ padding: '1rem', display: 'flex', alignItems: 'center' }}>
              <Loader2 className="animate-spin" size={24} color="var(--primary-color)" style={{ animation: 'spin 1s linear infinite' }} />
              <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '1.5rem', borderTop: '1px solid var(--surface-border)', background: 'rgba(15, 23, 42, 0.6)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question..."
            className="input-field"
            style={{ paddingRight: '4rem', borderRadius: 'var(--radius-full)' }}
            disabled={isLoading}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            style={{
              position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
              background: input.trim() ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)',
              border: 'none', borderRadius: '50%', width: '40px', height: '40px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              color: 'white', transition: 'var(--transition)'
            }}
          >
            <Send size={18} style={{ marginLeft: '2px' }} />
          </button>
        </form>
      </div>

    </div>
  );
};

export default Chat;
