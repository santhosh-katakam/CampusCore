import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const Chatbot = ({ isHidden, user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: `Hello ${user?.name || 'there'}! I'm your College AI Assistant. How can I help you today?` }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    if (isHidden) return null;

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsTyping(true);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('http://localhost:4000/api/chatbot', { 
                message: input,
                context: {
                    user: user?.name,
                    role: user?.role,
                    batch: user?.batch
                }
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting right now. Please try again later." }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 9999 }}>
            {/* Chat Window */}
            {isOpen && (
                <div style={{
                    width: '380px',
                    height: '550px',
                    backgroundColor: 'white',
                    borderRadius: '20px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    marginBottom: '20px',
                    border: '1px solid #e2e8f0',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '20px',
                        background: 'linear-gradient(135deg, #4c51bf 0%, #6366f1 100%)',
                        color: 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#48bb78' }}></div>
                            <span style={{ fontWeight: 'bold' }}>College AI Assistant</span>
                        </div>
                        <button 
                            onClick={() => setIsOpen(false)}
                            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer', padding: '0 5px' }}
                        >
                            ×
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{
                        flex: 1,
                        padding: '20px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '15px',
                        backgroundColor: '#f8fafc'
                    }}>
                        {messages.map((m, i) => (
                            <div key={i} style={{
                                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '80%',
                                padding: '12px 16px',
                                borderRadius: m.role === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                                backgroundColor: m.role === 'user' ? '#4c51bf' : 'white',
                                color: m.role === 'user' ? 'white' : '#1a202c',
                                fontSize: '14px',
                                lineHeight: '1.5',
                                boxShadow: m.role === 'user' ? '0 4px 6px rgba(76, 81, 191, 0.2)' : '0 1px 2px rgba(0,0,0,0.05)',
                                border: m.role === 'user' ? 'none' : '1px solid #e2e8f0'
                            }}>
                                {m.content}
                            </div>
                        ))}
                        {isTyping && (
                            <div style={{ alignSelf: 'flex-start', padding: '12px 16px', backgroundColor: 'white', borderRadius: '18px', fontSize: '12px', color: '#718096' }}>
                                Assistant is typing...
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSend} style={{ padding: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
                        <input 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask me anything..."
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                outline: 'none',
                                fontSize: '14px'
                            }}
                        />
                        <button 
                            type="submit"
                            style={{
                                backgroundColor: '#4c51bf',
                                color: 'white',
                                border: 'none',
                                width: '45px',
                                height: '45px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: '0.2s'
                            }}
                        >
                            ➜
                        </button>
                    </form>
                </div>
            )}

            {/* Toggle Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '30px',
                    backgroundColor: '#4c51bf',
                    boxShadow: '0 10px 25px rgba(76, 81, 191, 0.4)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    transition: '0.3s transform',
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    float: 'right'
                }}
            >
                {isOpen ? '×' : '💬'}
            </button>

            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                ::-webkit-scrollbar {
                    width: 6px;
                }
                ::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                ::-webkit-scrollbar-thumb {
                    background: #cbd5e0;
                    border-radius: 3px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #a0aec0;
                }
            `}</style>
        </div>
    );
};

export default Chatbot;
