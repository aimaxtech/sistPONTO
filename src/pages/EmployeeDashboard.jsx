import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import PunchButton from '../components/PunchButton';

import { db } from '../services/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import InstallButton from '../components/InstallButton';

const EmployeeDashboard = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();

    const [view, setView] = useState('dashboard'); // 'dashboard' or 'history'
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [showJustificationModal, setShowJustificationModal] = useState(false);

    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!currentUser) return;
            setLoadingHistory(true);
            try {
                const q = query(
                    collection(db, 'punches'),
                    where('userId', '==', currentUser.uid),
                    orderBy('timestamp', 'desc')
                );
                const querySnapshot = await getDocs(q);
                const data = querySnapshot.docs.map(doc => {
                    const punch = doc.data();
                    const ts = punch.timestamp?.toDate() || new Date();
                    return {
                        id: doc.id,
                        date: ts.toLocaleDateString('pt-BR'),
                        time: ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                        type: punch.type,
                        location: punch.location ? 'Localizado' : 'N/A'
                    };
                });
                setHistoryData(data);
            } catch (error) {
                console.error("Erro ao buscar histórico:", error);
            } finally {
                setLoadingHistory(false);
            }
        };

        if (view === 'history') {
            fetchHistory();
        }
    }, [currentUser, view]);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Erro ao sair:', error);
        }
    };

    const handleDownloadReceipt = (record) => {
        alert(`Comprovante do dia ${record.date} - ${record.time} baixado com sucesso! 📄`);
    };

    const handleJustificationSubmit = (e) => {
        e.preventDefault();
        alert('Justificativa enviada para análise! ✅');
        setShowJustificationModal(false);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 selection:bg-emerald-500/30 font-sans">
            {/* Background Decoration */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-5%] left-[-5%] w-[30%] h-[30%] bg-emerald-900/10 blur-[100px] rounded-full"></div>
                <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-emerald-900/5 blur-[100px] rounded-full"></div>
            </div>

            <div className="relative z-10 min-h-screen pb-10">
                {/* Justification Modal */}
                {showJustificationModal && (
                    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md italic selection:bg-emerald-500/30">
                        <div className="bg-black/60 backdrop-blur-2xl border-2 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden animate-fade-in relative">
                            <div className="absolute top-0 right-0 p-2 opacity-20">
                                <div className="w-20 h-20 border-t border-r border-emerald-500"></div>
                            </div>

                            <div className="bg-emerald-500/10 px-8 py-5 border-b border-white/5 flex justify-between items-center text-white">
                                <div>
                                    <h3 className="font-black uppercase tracking-[0.3em] text-xs text-emerald-500">Nova_Justificativa_Ponto</h3>
                                    <p className="text-[9px] font-mono text-emerald-500/40 uppercase mt-1">SISTEMA_AUDITORIA_V1.0</p>
                                </div>
                                <button onClick={() => setShowJustificationModal(false)} className="text-white/50 hover:text-emerald-500 font-bold text-2xl transition-colors">&times;</button>
                            </div>

                            <form onSubmit={handleJustificationSubmit} className="p-8 space-y-6">
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Tipo_Ocorrência</label>
                                        <select className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase appearance-none cursor-pointer">
                                            <option className="bg-gray-900">Atestado Médico</option>
                                            <option className="bg-gray-900">Atraso de Transporte</option>
                                            <option className="bg-gray-900">Esquecimento</option>
                                            <option className="bg-gray-900">Outros</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Data_Incidente</label>
                                        <input type="date" className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Observações_Técnicas</label>
                                        <textarea className="w-full bg-white/5 border border-white/10 p-3 h-24 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase resize-none placeholder-gray-600" placeholder="DESCREVA O MOTIVO..."></textarea>
                                    </div>
                                    <div className="border border-dashed border-white/10 bg-white/2 p-4 text-center text-gray-400 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 cursor-pointer transition-all">
                                        📎 ANEXAR_DOCUMENTO_PDF_IMG
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4 border-t border-white/5">
                                    <button type="button" onClick={() => setShowJustificationModal(false)} className="flex-1 px-4 py-3 border border-white/10 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-white hover:border-white/30 transition-all">ABORTAR</button>
                                    <button type="submit" className="flex-1 px-4 py-3 bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg active:scale-95">ENVIAR_ANALISE</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Header Mobile */}
                <header className="bg-black/40 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40">
                    <div className="max-w-md mx-auto px-4 py-4">
                        <div className="flex justify-between items-center text-white">
                            <div className="flex items-center gap-3">
                                {view === 'history' && (
                                    <button
                                        onClick={() => setView('dashboard')}
                                        className="p-2 bg-white/5 border border-white/10 text-emerald-500 hover:border-emerald-500/50 transition-all active:scale-95"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                    </button>
                                )}
                                <div>
                                    <h1 className="text-lg font-black tracking-tighter uppercase italic text-emerald-500">
                                        {view === 'history' ? '📜 Log_Histórico' : '🌱 Sistema de Ponto'}
                                    </h1>
                                    <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                                        {view === 'history' ? 'Rastreamento_Arquivado' : `OP: ${currentUser?.name || 'FUNCIONÁRIO'}`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2 items-center">
                                <InstallButton />
                                <button
                                    onClick={handleLogout}
                                    className="px-4 py-2 bg-white/5 border border-white/10 text-white font-black text-[9px] uppercase tracking-widest hover:bg-red-500 hover:text-white hover:border-red-500 transition-all active:scale-95"
                                >
                                    Sair
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-md mx-auto px-4 py-8">

                    {view === 'dashboard' ? (
                        <>
                            {/* Status Card & Time Bank */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-5 shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <svg className="w-10 h-10 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" /></svg>
                                    </div>
                                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Hora_Atual</h2>
                                    <p className="text-2xl font-black text-white tracking-tighter">
                                        {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-5 shadow-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                                    <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <svg className="w-10 h-10 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                    </div>
                                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Banco_Saldo</h2>
                                    <p className="text-2xl font-black text-emerald-500 tracking-tighter italic">+02:15</p>
                                </div>
                            </div>

                            {/* Punch Button Container */}
                            <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-6 shadow-2xl mb-6">
                                <PunchButton />
                            </div>

                            {/* Actions Row */}
                            <div className="grid grid-cols-2 gap-4 mt-6">
                                <button
                                    onClick={() => setView('history')}
                                    className="group bg-white/5 border border-white/10 p-5 text-left hover:border-emerald-500/50 hover:bg-white/10 transition-all shadow-lg active:scale-95"
                                >
                                    <p className="text-2xl mb-2 group-hover:scale-110 transition-transform">📜</p>
                                    <p className="text-xs font-black text-white uppercase leading-none tracking-tight">Logs Históricos</p>
                                    <p className="text-[10px] text-gray-400 mt-2 font-mono uppercase tracking-widest">Acessar_DB</p>
                                </button>
                                <button
                                    onClick={() => setShowJustificationModal(true)}
                                    className="group bg-white/5 border border-white/10 p-5 text-left hover:border-emerald-500/50 hover:bg-white/10 transition-all shadow-lg active:scale-95"
                                >
                                    <p className="text-2xl mb-2 group-hover:scale-110 transition-transform">📝</p>
                                    <p className="text-xs font-black text-white uppercase leading-none tracking-tight">Justificar</p>
                                    <p className="text-[10px] text-gray-400 mt-2 font-mono uppercase tracking-widest">Abrir_Chamado</p>
                                </button>
                            </div>

                            {/* Today's Records */}
                            <div className="bg-black/40 backdrop-blur-xl border border-white/5 overflow-hidden shadow-2xl mt-6">
                                <div className="bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-500 px-4 py-2 flex justify-between items-center font-mono">
                                    <span className="text-[10px] font-black uppercase tracking-widest italic">Registros_Diários</span>
                                    <span className="text-[10px] opacity-50 uppercase">Today_Audit</span>
                                </div>
                                <div className="p-0 divide-y divide-white/5">
                                    <div className="text-center py-12 text-gray-400 bg-white/2">
                                        <p className="text-4xl mb-3 opacity-10">🌑</p>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] italic">Aguardando_Primeiro_Ponto</p>
                                    </div>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="mt-8 bg-emerald-500/5 border border-emerald-500/10 p-5 shadow-inner">
                                <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                    Protocolos_Operativos
                                </h4>
                                <ul className="text-[9px] space-y-2 text-gray-400 font-mono uppercase tracking-widest">
                                    <li className="flex gap-2"><span>[01]</span> ATIVE_GEO_LOCALIZAÇÃO_SISTEMA</li>
                                    <li className="flex gap-2"><span>[02]</span> REGISTRE_ENTRADA_SAÍDA_INTERVALOS</li>
                                    <li className="flex gap-2"><span>[03]</span> AUDITORIA_FACIAL_OBRIGATÓRIA</li>
                                </ul>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6 animate-fade-in">
                            {/* Filters */}
                            <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-6 shadow-2xl">
                                <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] mb-3 pl-1">Selecione_Período</label>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase"
                                />
                            </div>

                            {/* History List */}
                            <div className="space-y-6">
                                {['15/02/2026', '14/02/2026'].map(date => (
                                    <div key={date} className="bg-black/40 backdrop-blur-xl border border-white/5 overflow-hidden shadow-2xl">
                                        <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex justify-between items-center">
                                            <span className="text-[10px] font-mono text-emerald-500 font-black">{date}</span>
                                            <span className="text-[9px] font-mono text-gray-400 uppercase">Jornada: 08:00h</span>
                                        </div>
                                        <div className="p-4 space-y-4">
                                            {historyData.filter(d => d.date === date).map((record, index) => (
                                                <div key={index} className="flex justify-between items-center group">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${record.type === 'entrada' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                                            record.type.includes('saida') ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-yellow-500'
                                                            }`}></div>
                                                        <div>
                                                            <p className="text-[10px] font-black text-white uppercase tracking-tighter">
                                                                {record.type.replace('_', ' ')}
                                                            </p>
                                                            <p className="text-[8px] font-mono text-gray-400 mt-0.5">{record.location.toUpperCase()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-xs font-black font-mono text-emerald-500">{record.time}</span>
                                                        <button
                                                            onClick={() => handleDownloadReceipt(record)}
                                                            className="text-gray-600 hover:text-emerald-500 transition-all active:scale-95"
                                                            title="BAIXAR_VOUCHER"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                <button className="w-full py-6 text-center text-gray-600 hover:text-emerald-500 text-[10px] font-black uppercase tracking-[0.4em] transition-all italic">
                                    CARREGAR_MAIS_LOGS_DB
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default EmployeeDashboard;
