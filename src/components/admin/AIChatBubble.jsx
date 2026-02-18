import { useState, useRef, useEffect } from 'react';
import { startRaquelChat, sendMessageToRaquel } from '../../services/aiService';
import { useAuth } from '../../contexts/AuthContext';
import { generatePDFReport, generateEspelhoPontoPDF } from '../../utils/pdfGenerator';

const AIChatBubble = () => {
    const { currentCompany } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: 'raquel',
            text: `Boa tarde! Seja bem-vindo à ${currentCompany?.name || 'nossa empresa'}! Eu sou a Raquel, a assistente de RH. Em que posso ajudar você hoje?`
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [chatSession, setChatSession] = useState(null);
    const messagesEndRef = useRef(null);

    // Inicializa o chat quando abre pela primeira vez
    useEffect(() => {
        if (isOpen && !chatSession && currentCompany?.id) {
            const session = startRaquelChat(currentCompany.id, currentCompany.name);
            setChatSession(session);

            // Atualiza a primeira mensagem com o nome real da empresa se disponível
            if (currentCompany.name) {
                setMessages([{
                    role: 'raquel',
                    text: `Boa tarde! Seja bem-vindo à ${currentCompany.name}! Eu sou a Raquel, a assistente de RH. Em que posso ajudar você hoje?`
                }]);
            }
        }
    }, [isOpen, currentCompany?.id, currentCompany?.name, chatSession]);

    // Rola para o fim das mensagens
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputText.trim() || isTyping) return;

        const userMsg = inputText.trim();
        setInputText('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsTyping(true);

        try {
            const response = await sendMessageToRaquel(chatSession, userMsg, currentCompany?.id);
            setMessages(prev => [...prev, {
                role: 'raquel',
                text: response.text,
                actionData: response.actionData
            }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'raquel', text: 'Tive um pequeno curto-circuito. Pode repetir?' }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999]">
            {/* Balão de Chat */}
            {isOpen && (
                <div className="absolute bottom-20 right-0 w-[350px] md:w-[400px] h-[500px] bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-fade-in">
                    {/* Header */}
                    <div className="p-5 bg-primary-500 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-black rounded-full flex items-center justify-center text-xl shadow-lg ring-2 ring-black/10">🤖</div>
                            <div>
                                <h3 className="text-black font-black text-xs uppercase tracking-widest">RAQUEL_AI</h3>
                                <p className="text-[9px] text-black/60 font-bold uppercase">Online & Atenta</p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-black/40 hover:text-black transition-colors text-xl">✕</button>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-4 rounded-2xl text-[11px] font-mono leading-relaxed ${msg.role === 'user'
                                    ? 'bg-primary-500/10 border border-primary-500/20 text-primary-500 rounded-tr-none'
                                    : 'bg-white/5 border border-white/10 text-gray-300 rounded-tl-none'
                                    }`}>
                                    {msg.text.split('\n').map((line, i) => (
                                        <p key={i} className={line.startsWith('**') || line.startsWith('📊') ? 'font-black text-white mb-1' : 'mb-1'}>
                                            {line.replace(/\*\*/g, '')}
                                        </p>
                                    ))}

                                    {/* Botões de Ação para Relatórios */}
                                    {msg.actionData?.type === 'PDF_REPORT' && (
                                        <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-3">
                                            <button
                                                onClick={() => generatePDFReport(msg.actionData.data, msg.actionData.filters, currentCompany)}
                                                className="w-full py-2 bg-primary-500 text-black font-black text-[9px] uppercase tracking-tighter hover:bg-primary-400 transition-all flex items-center justify-center gap-2"
                                            >
                                                <span>📥</span> Baixar PDF Geral
                                            </button>
                                            {msg.actionData.employee && (
                                                <button
                                                    onClick={() => generateEspelhoPontoPDF(msg.actionData.data, msg.actionData.employee, msg.actionData.filters, currentCompany)}
                                                    className="w-full py-2 bg-white/10 text-white font-black text-[9px] uppercase tracking-tighter hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <span>📄</span> Espelho de Ponto (Assinatura)
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-white/5 border border-white/10 p-3 rounded-2xl rounded-tl-none flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                    <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Footer / Input */}
                    <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-white/[0.02]">
                        <div className="relative">
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="DIGITE SUA DÚVIDA OU COMANDO..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pr-12 text-[10px] font-mono uppercase text-white outline-none focus:border-primary-500 transition-all placeholder:text-gray-600"
                            />
                            <button
                                type="submit"
                                disabled={isTyping}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-500 hover:text-primary-400 disabled:opacity-30"
                            >
                                ⚡
                            </button>
                        </div>
                        <p className="text-[7px] text-gray-700 mt-2 text-center uppercase font-bold tracking-widest">
                            RAQUEL_CORE_V1.1 // POWERED_BY_IA
                        </p>
                    </form>
                </div>
            )
            }

            {/* Bubble Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-2xl transition-all duration-500 group relative ${isOpen ? 'bg-black rotate-90' : 'bg-primary-500 hover:scale-110 active:scale-95'
                    }`}
            >
                {isOpen ? (
                    <span className="text-white text-xl">✕</span>
                ) : (
                    <>
                        <span className="relative z-10 group-hover:rotate-12 transition-transform">🤖</span>
                        <div className="absolute inset-0 rounded-full bg-primary-500 animate-ping opacity-20"></div>
                    </>
                )}
            </button>
        </div >
    );
};

export default AIChatBubble;
