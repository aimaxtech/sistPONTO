import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import PunchButton from '../components/PunchButton';
import { WORK_HOURS_PER_DAY } from '../config/firebase';

import { db } from '../services/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import InstallButton from '../components/InstallButton';

const EmployeeDashboard = () => {
    const { currentUser, currentCompany, logout } = useAuth();
    const navigate = useNavigate();

    const [view, setView] = useState('dashboard'); // 'dashboard' or 'history'
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [showJustificationModal, setShowJustificationModal] = useState(false);

    const [todayPunches, setTodayPunches] = useState([]);
    const [historyData, setHistoryData] = useState([]); // Added missing state
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [timeBank, setTimeBank] = useState({ balance: 0, loading: true });

    const fetchTodayPunches = async () => {
        if (!currentUser) return;
        try {
            // Usar data local para evitar problemas de fuso horário UTC
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            // Query simples (sem orderBy para não exigir índice composto manual)
            const q = query(
                collection(db, 'punches'),
                where('userId', '==', currentUser.uid)
            );

            const querySnapshot = await getDocs(q);
            const allPunches = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filtra por hoje na memória para evitar erro de índice
            const data = allPunches.filter(p => p.date === today).map(p => ({
                ...p,
                time: p.timestamp?.toDate ? p.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) :
                    new Date(p.offlineTimestamp || now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }));

            // Ordenar por timestamp no JavaScript
            const sortedData = data.sort((a, b) => {
                const timeA = a.timestamp?.toDate() || new Date(a.offlineTimestamp);
                const timeB = b.timestamp?.toDate() || new Date(b.offlineTimestamp);
                return timeA - timeB;
            });

            setTodayPunches(sortedData);
        } catch (error) {
            console.error("Erro ao buscar pontos de hoje:", error);
            alert("Erro ao carregar registros de hoje. Verifique sua conexão.");
        }
    };

    const fetchTimeBank = async () => {
        if (!currentUser) return;
        try {
            const now = new Date();
            const firstDayOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

            const q = query(
                collection(db, 'punches'),
                where('userId', '==', currentUser.uid)
            );

            const querySnapshot = await getDocs(q);
            const allPunches = querySnapshot.docs.map(doc => doc.data());

            // Filtra por mês atual na memória para evitar erro de índice
            const data = allPunches.filter(p => p.date >= firstDayOfMonth);

            const dailyData = {};
            data.forEach(p => {
                if (!dailyData[p.date]) dailyData[p.date] = [];
                dailyData[p.date].push(p);
            });

            let totalWorkedMs = 0;
            let firstWorkDay = null;
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            let todayWorkedMs = 0;

            Object.keys(dailyData).forEach(dateStr => {
                const punches = dailyData[dateStr];
                const sorted = punches.sort((a, b) => {
                    const tA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.offlineTimestamp || 0);
                    const tB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.offlineTimestamp || 0);
                    return tA - tB;
                });

                const currentDayDate = new Date(dateStr + 'T12:00:00');
                if (!firstWorkDay || currentDayDate < firstWorkDay) {
                    firstWorkDay = currentDayDate;
                }

                let lastIn = null;
                sorted.forEach((p, idx) => {
                    const isEntry = p.type === 'entrada' || p.type === 'volta_almoco' || p.type === 'volta_eventual';
                    const isExit = p.type === 'saida_almoco' || p.type === 'saida' || p.type === 'saida_eventual';

                    if (isEntry) {
                        lastIn = p.timestamp?.toDate ? p.timestamp.toDate() : new Date(p.offlineTimestamp || 0);
                    } else if (isExit && lastIn) {
                        const currentOut = p.timestamp?.toDate ? p.timestamp.toDate() : new Date(p.offlineTimestamp || 0);
                        const diff = (currentOut - lastIn);
                        totalWorkedMs += diff;
                        if (dateStr === todayStr) todayWorkedMs += diff;
                        lastIn = null;
                    }

                    if (p.type === 'saida_eventual' && p.isAbonado) {
                        const nextReturn = sorted.find((next, nIdx) => nIdx > idx && next.type === 'volta_eventual');
                        if (nextReturn) {
                            const startAbo = p.timestamp?.toDate ? p.timestamp.toDate() : new Date(p.offlineTimestamp || 0);
                            const endAbo = nextReturn.timestamp?.toDate ? nextReturn.timestamp.toDate() : new Date(nextReturn.offlineTimestamp || 0);
                            const diffAbo = (endAbo - startAbo);
                            totalWorkedMs += diffAbo;
                            if (dateStr === todayStr) todayWorkedMs += diffAbo;
                        }
                    }
                });

                // Se ainda estiver com um ponto aberto HOJE, soma o tempo parcial
                if (dateStr === todayStr && lastIn) {
                    todayWorkedMs += (now - lastIn);
                }
            });

            let expectedHours = 0;
            if (firstWorkDay) {
                const tempDate = new Date(firstWorkDay);
                // Comparamos até ONTEM para o saldo acumulado, ou até HOJE se o dia já passou
                const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);

                while (tempDate <= endOfYesterday) {
                    const dayOfWeek = tempDate.getDay();
                    const dateStr = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`;

                    // Verificar se o dia está dentro de um período de afastamento/férias
                    const isAway = currentUser.status &&
                        currentUser.status !== 'ativo' &&
                        currentUser.statusStart &&
                        currentUser.statusEnd &&
                        dateStr >= currentUser.statusStart &&
                        dateStr <= currentUser.statusEnd;

                    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isAway) {
                        expectedHours += (currentCompany?.workHours || WORK_HOURS_PER_DAY);
                    }
                    tempDate.setDate(tempDate.getDate() + 1);
                }
            }

            const workedHoursFull = totalWorkedMs / 3600000;
            const workedHoursToday = todayWorkedMs / 3600000;
            const balance = workedHoursFull - expectedHours;

            setTimeBank({
                balance: balance,
                workedHours: workedHoursToday,
                expectedHours: expectedHours,
                loading: false
            });
        } catch (error) {
            console.error("Erro banco horas:", error);
            setTimeBank(prev => ({ ...prev, loading: false }));
        }
    };

    useEffect(() => {
        fetchTodayPunches();
        fetchTimeBank();

        // Relógio do Banco de Horas (atualiza contador de 'Trabalhado Hoje' em tempo real)
        const timer = setInterval(() => {
            fetchTimeBank();
        }, 30000); // 30 segundos

        return () => clearInterval(timer);
    }, [currentUser]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!currentUser) return;
            setLoadingHistory(true);
            try {
                // Modified to avoid compound query needing index
                const q = query(
                    collection(db, 'punches'),
                    where('userId', '==', currentUser.uid)
                );

                const querySnapshot = await getDocs(q);
                const data = querySnapshot.docs.map(doc => {
                    const punch = doc.data();
                    const ts = punch.timestamp?.toDate() || new Date(punch.offlineTimestamp || Date.now());
                    return {
                        id: doc.id,
                        date: ts.toLocaleDateString('pt-BR'),
                        rawDate: ts, // For sorting
                        time: ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                        type: punch.type,
                        location: punch.location ? 'Localizado' : 'N/A'
                    };
                });

                // Sort in memory
                data.sort((a, b) => b.rawDate - a.rawDate);

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
                        <div className="bg-black/60 backdrop-blur-2xl border-2 border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden animate-fade-in relative">
                            <div className="absolute top-0 right-0 p-2 opacity-20">
                                <div className="w-20 h-20 border-t border-r border-emerald-500"></div>
                            </div>

                            <div className="bg-emerald-500/10 px-8 py-5 border-b border-white/5 flex justify-between items-center text-white">
                                <div>
                                    <h3 className="font-black uppercase tracking-[0.3em] text-xs text-emerald-500">Nova Justificativa Ponto</h3>
                                    <p className="text-[9px] font-mono text-emerald-500/40 uppercase mt-1">SISTEMA_AUDITORIA_V1.0</p>
                                </div>
                                <button onClick={() => setShowJustificationModal(false)} className="text-white/50 hover:text-emerald-500 font-bold text-2xl transition-colors">&times;</button>
                            </div>

                            <form onSubmit={handleJustificationSubmit} className="p-8 space-y-6">
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Tipo Ocorrência</label>
                                        <select className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase appearance-none cursor-pointer">
                                            <option className="bg-gray-900">Atestado Médico</option>
                                            <option className="bg-gray-900">Atraso de Transporte</option>
                                            <option className="bg-gray-900">Esquecimento</option>
                                            <option className="bg-gray-900">Outros</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Data Incidente</label>
                                        <input type="date" className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Observações Técnicas</label>
                                        <textarea className="w-full bg-white/5 border border-white/10 p-3 h-24 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase resize-none placeholder-gray-600" placeholder="DESCREVA O MOTIVO..."></textarea>
                                    </div>
                                    <div className="border border-dashed border-white/10 bg-white/2 p-4 text-center text-gray-400 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 cursor-pointer transition-all">
                                        📎 ANEXAR_DOCUMENTO_PDF_IMG
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4 border-t border-white/5">
                                    <button type="button" onClick={() => setShowJustificationModal(false)} className="flex-1 px-4 py-3 border border-white/10 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-white hover:border-white/30 transition-all">ABORTAR</button>
                                    <button type="submit" className="flex-1 px-4 py-3 bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg active:scale-95">ENVIAR ANALISE</button>
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
                                        {view === 'history' ? '📜 Log_Histórico' : (currentCompany?.name || 'Sistema de Ponto')}
                                    </h1>
                                    <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                                        {view === 'history' ? 'Rastreamento_Arquivado' : `ORG: ${currentCompany?.name ? currentCompany.name.slice(0, 15) : '---'} | OP: ${currentUser?.name || 'USER'}`}
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
                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-5 rounded-2xl shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <svg className="w-10 h-10 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" /></svg>
                                    </div>
                                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Trabalhado Hoje</h2>
                                    <p className="text-2xl font-black text-white tracking-tighter">
                                        {timeBank.loading ? '...' :
                                            `${Math.floor(timeBank.workedHours || 0).toString().padStart(2, '0')}:${Math.round(((timeBank.workedHours || 0) % 1) * 60).toString().padStart(2, '0')}`
                                        }
                                    </p>
                                </div>
                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-5 rounded-2xl shadow-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                                    <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <svg className="w-10 h-10 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                    </div>
                                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Banco Saldo</h2>
                                    <p className={`text-2xl font-black tracking-tighter italic ${timeBank.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {timeBank.loading ? '...' :
                                            `${timeBank.balance >= 0 ? '+' : '-'}${Math.abs(Math.floor(timeBank.balance)).toString().padStart(2, '0')}:${Math.abs(Math.round((timeBank.balance % 1) * 60)).toString().padStart(2, '0')}`
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Punch Button Container */}
                            <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-6 rounded-2xl shadow-2xl mb-6">
                                <PunchButton onPunchSuccess={() => {
                                    fetchTodayPunches();
                                    fetchTimeBank();
                                }} />
                            </div>

                            {/* Actions Row */}
                            <div className="grid grid-cols-2 gap-4 mt-6">
                                <button
                                    onClick={() => setView('history')}
                                    className="group bg-white/5 border border-white/10 p-5 text-left hover:border-emerald-500/50 hover:bg-white/10 transition-all shadow-lg active:scale-95"
                                >
                                    <p className="text-2xl mb-2 group-hover:scale-110 transition-transform">📜</p>
                                    <p className="text-xs font-black text-white uppercase leading-none tracking-tight">Logs Históricos</p>
                                    <p className="text-[10px] text-gray-400 mt-2 font-mono uppercase tracking-widest">Acessar DB</p>
                                </button>
                                <button
                                    onClick={() => setShowJustificationModal(true)}
                                    className="group bg-white/5 border border-white/10 p-5 text-left hover:border-emerald-500/50 hover:bg-white/10 transition-all shadow-lg active:scale-95"
                                >
                                    <p className="text-2xl mb-2 group-hover:scale-110 transition-transform">📝</p>
                                    <p className="text-xs font-black text-white uppercase leading-none tracking-tight">Justificar</p>
                                    <p className="text-[10px] text-gray-400 mt-2 font-mono uppercase tracking-widest">Abrir Chamado</p>
                                </button>
                            </div>

                            {/* Today's Records */}
                            <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl mt-6">
                                <div className="bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-500 px-4 py-2 flex justify-between items-center font-mono">
                                    <span className="text-[10px] font-black uppercase tracking-widest italic">Registros Diários</span>
                                    <span className="text-[10px] opacity-50 uppercase">Today_Audit</span>
                                </div>
                                <div className="p-0 divide-y divide-white/5">
                                    {todayPunches.length > 0 ? (
                                        todayPunches.map((punch) => (
                                            <div key={punch.id} className="flex justify-between items-center p-4 bg-white/2 hover:bg-emerald-500/5 transition-colors group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-none border border-emerald-500/30 flex items-center justify-center text-emerald-500 bg-emerald-500/5 font-black text-[10px] group-hover:border-emerald-500 transition-all">
                                                        {punch.type === 'entrada' ? '🌅' :
                                                            punch.type === 'saida_almoco' ? '🍽️' :
                                                                punch.type === 'volta_almoco' ? '↩️' : '🌙'}
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase text-white tracking-widest leading-none mb-1">
                                                            {punch.type.replace('_', ' ')}
                                                        </p>
                                                        <p className="text-[8px] font-mono text-gray-500 uppercase">Status: Confirmado</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-emerald-500 tracking-tighter">{punch.time}</p>
                                                    <p className="text-[8px] font-mono text-gray-500 uppercase">Sinc: OK</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12 text-gray-400 bg-white/2">
                                            <p className="text-4xl mb-3 opacity-10">🌑</p>
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] italic">Aguardando Primeiro Ponto</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="mt-8 bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-2xl shadow-inner">
                                <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                    Protocolos Operativos
                                </h4>
                                <ul className="text-[9px] space-y-2 text-gray-400 font-mono uppercase tracking-widest">
                                    <li className="flex gap-2"><span>[01]</span> ATIVE GEO LOCALIZAÇÃO SISTEMA</li>
                                    <li className="flex gap-2"><span>[02]</span> REGISTRE ENTRADA SAÍDA INTERVALOS</li>
                                    <li className="flex gap-2"><span>[03]</span> AUDITORIA FACIAL OBRIGATÓRIA</li>
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
                                {
                                    // Get unique dates from historyData
                                    [...new Set(historyData.map(d => d.date))].map(date => (
                                        <div key={date} className="bg-black/40 backdrop-blur-xl border border-white/5 overflow-hidden shadow-2xl">
                                            <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex justify-between items-center">
                                                <span className="text-[10px] font-mono text-emerald-500 font-black">{date}</span>
                                                {/* TODO: Calculate daily total here if needed */}
                                                <span className="text-[9px] font-mono text-gray-400 uppercase">Jornada: --:--</span>
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
