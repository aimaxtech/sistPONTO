import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import PunchButton from '../components/PunchButton';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp as firestoreTimestamp, orderBy } from 'firebase/firestore';
import InstallButton from '../components/InstallButton';

const EmployeeDashboard = () => {
    const { currentUser, currentCompany, logout } = useAuth();
    const navigate = useNavigate();

    const [view, setView] = useState('dashboard');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [showJustificationModal, setShowJustificationModal] = useState(false);
    const [todayPunches, setTodayPunches] = useState([]);
    const [historyData, setHistoryData] = useState([]);
    const [justificationsList, setJustificationsList] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [timeBank, setTimeBank] = useState({ balance: 0, workedHours: 0, loading: true });
    const [dailyTotals, setDailyTotals] = useState({});

    // Estados para Justificativa
    const [justificationData, setJustificationData] = useState({ type: 'Atestado Médico', date: '', obs: '', file: null });
    const [isSendingJustification, setIsSendingJustification] = useState(false);

    const fetchTodayPunches = async () => {
        if (!currentUser) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const q = query(collection(db, 'punches'), where('userId', '==', currentUser.uid), where('date', '==', today));
            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                time: doc.data().timestamp?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || '--:--'
            })).sort((a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0));
            setTodayPunches(data);
        } catch (error) { console.error(error); }
    };

    const fetchTimeBank = async () => {
        if (!currentUser) return;
        try {
            const { calculateWorkedMinutes, calculateDailyBalance } = await import('../utils/timeUtils');
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const q = query(collection(db, 'logs'), where('userId', '==', currentUser.uid), where('date', '>=', startOfMonth));
            const snap = await getDocs(q);
            const allLogs = snap.docs.map(d => d.data());

            const logsByDay = allLogs.reduce((acc, log) => { acc[log.date] = acc[log.date] || []; acc[log.date].push(log); return acc; }, {});
            let totalBalance = 0;
            let workedToday = 0;
            const todayStr = now.toISOString().split('T')[0];

            Object.keys(logsByDay).forEach(dateStr => {
                const dayMinutes = calculateWorkedMinutes(logsByDay[dateStr]);
                if (dateStr === todayStr) workedToday = dayMinutes;

                totalBalance += calculateDailyBalance(logsByDay[dateStr], dayMinutes, currentCompany?.workHours || 8);
            });
            setTimeBank({ balance: totalBalance, workedHours: workedToday / 60, loading: false });
        } catch (error) { console.error(error); }
    };

    const fetchJustifications = async () => {
        if (!currentUser) return;
        try {
            const q = query(collection(db, 'logs'), where('userId', '==', currentUser.uid), where('type', '==', 'justificativa'), orderBy('timestamp', 'desc'));
            const snap = await getDocs(q);
            setJustificationsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) { console.error(error); }
    };

    useEffect(() => {
        fetchTodayPunches();
        fetchTimeBank();
        fetchJustifications();
        const timer = setInterval(fetchTimeBank, 60000);
        return () => clearInterval(timer);
    }, [currentUser, currentCompany]);

    useEffect(() => {
        if (view === 'history') {
            const fetchHistory = async () => {
                setLoadingHistory(true);
                try {
                    const { calculateWorkedMinutes, formatMinutes } = await import('../utils/timeUtils');
                    const q = query(collection(db, 'logs'), where('userId', '==', currentUser.uid));
                    const snap = await getDocs(q);
                    const data = snap.docs.map(doc => {
                        const p = doc.data();
                        const ts = p.timestamp?.toDate() || new Date();
                        return { id: doc.id, ...p, date: p.date, rawDate: ts, time: ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
                    });

                    const punchesOnly = data.filter(d => d.type !== 'justificativa');
                    const grouped = punchesOnly.reduce((acc, p) => { acc[p.date] = acc[p.date] || []; acc[p.date].push(p); return acc; }, {});
                    const totals = {};
                    Object.keys(grouped).forEach(date => {
                        totals[date] = formatMinutes(calculateWorkedMinutes(grouped[date])).replace('+', '');
                    });
                    setDailyTotals(totals);
                    setHistoryData(data.sort((a, b) => b.rawDate - a.rawDate));
                } catch (e) { console.error(e); } finally { setLoadingHistory(false); }
            };
            fetchHistory();
        }
    }, [view, currentUser]);

    const handleLogout = async () => { try { await logout(); navigate('/login'); } catch (e) { console.error(e); } };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setJustificationData({ ...justificationData, file: reader.result });
            reader.readAsDataURL(file);
        }
    };

    const handleJustificationSubmit = async (e) => {
        e.preventDefault();
        setIsSendingJustification(true);
        try {
            await addDoc(collection(db, 'logs'), {
                userId: currentUser.uid,
                userName: currentUser.name,
                companyId: currentCompany.id,
                type: 'justificativa',
                date: justificationData.date,
                timestamp: firestoreTimestamp(),
                justification: justificationData.obs,
                justificationType: justificationData.type,
                certificateUrl: justificationData.file,
                status: 'pendente'
            });
            alert('Justificativa enviada! ✅');
            setShowJustificationModal(false);
            setJustificationData({ type: 'Atestado Médico', date: '', obs: '', file: null });
            fetchJustifications();
            fetchTimeBank();
        } catch (e) { alert("Erro: " + e.message); } finally { setIsSendingJustification(false); }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-primary-500/30">
            <header className="bg-black/60 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40">
                <div className="max-w-md mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {view === 'history' && (
                            <button onClick={() => setView('dashboard')} className="p-2 bg-white/5 border border-white/10 text-primary-500">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                        )}
                        <div>
                            <h1 className="text-sm font-black uppercase italic tracking-tighter text-primary-500 leading-none">
                                {view === 'history' ? 'LOG_HISTÓRICO' : (currentCompany?.name || 'SISTEMA PONTO')}
                            </h1>
                            <p className="text-[8px] font-mono text-gray-500 uppercase tracking-widest mt-1">
                                ID_USER: {currentUser?.name?.split(' ')[0] || 'OPERADOR'}
                            </p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="p-2 border border-white/10 text-gray-500 hover:text-red-500 hover:border-red-500/50 transition-all font-black text-[10px] uppercase tracking-widest">Sair</button>
                </div>
            </header>

            <main className="max-w-md mx-auto px-6 py-8">
                {view === 'dashboard' ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/40 border border-white/5 p-5 rounded-2xl">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Trabalhado Hoje</p>
                                <p className="text-2xl font-black text-white italic tracking-tighter">
                                    {timeBank.loading ? '--:--' : `${Math.floor(timeBank.workedHours).toString().padStart(2, '0')}:${Math.round((timeBank.workedHours % 1) * 60).toString().padStart(2, '0')}`}
                                </p>
                            </div>
                            <div className={`bg-black/40 border p-5 rounded-2xl transition-colors ${timeBank.balance >= 0 ? 'border-primary-500/20' : 'border-red-500/20'}`}>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Banco Saldo</p>
                                <p className={`text-2xl font-black italic tracking-tighter ${timeBank.balance >= 0 ? 'text-primary-500' : 'text-red-500'}`}>
                                    {timeBank.loading ? '--:--' : (timeBank.balance >= 0 ? '+' : '-') + Math.abs(Math.floor(timeBank.balance)).toString().padStart(2, '0') + ':' + Math.abs(Math.round((timeBank.balance % 1) * 60)).toString().padStart(2, '0')}
                                </p>
                            </div>
                        </div>

                        <div className="bg-black/40 border border-white/5 p-6 rounded-2xl shadow-2xl">
                            <PunchButton onPunchSuccess={() => { fetchTodayPunches(); fetchTimeBank(); }} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setView('history')} className="bg-white/5 border border-white/10 p-5 rounded-xl text-left hover:border-primary-500/30 transition-all">
                                <p className="text-xl mb-2">📜</p>
                                <p className="text-[10px] font-black text-white uppercase tracking-tight">Histórico Logs</p>
                            </button>
                            <button onClick={() => setShowJustificationModal(true)} className="bg-white/5 border border-white/10 p-5 rounded-xl text-left hover:border-primary-500/30 transition-all">
                                <p className="text-xl mb-2">📝</p>
                                <p className="text-[10px] font-black text-white uppercase tracking-tight">Justificar</p>
                            </button>
                        </div>

                        {/* Status das Justificativas */}
                        {justificationsList.length > 0 && (
                            <div className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                                <div className="bg-yellow-500/10 px-4 py-2 border-b border-white/5">
                                    <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest italic">Acompanhamento_Pedidos</p>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {justificationsList.slice(0, 3).map(j => (
                                        <div key={j.id} className="p-4 flex justify-between items-center group">
                                            <div>
                                                <p className="text-[10px] font-black text-white uppercase">{j.justificationType || 'Justificativa'}</p>
                                                <p className="text-[8px] font-mono text-gray-600 uppercase italic">{j.date}</p>
                                            </div>
                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-xs ${j.status === 'aprovado' ? 'bg-green-500 text-black' :
                                                    j.status === 'rejeitado' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'
                                                }`}>
                                                {j.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                            <div className="bg-primary-500/10 px-4 py-2 border-b border-white/5">
                                <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest italic">Registros_Hoje</p>
                            </div>
                            <div className="divide-y divide-white/5">
                                {todayPunches.length > 0 ? todayPunches.map(p => (
                                    <div key={p.id} className="p-4 flex justify-between items-center group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-sm bg-primary-500/5 border border-primary-500/20 flex items-center justify-center text-primary-500 text-xs font-black">
                                                {p.type === 'entrada' ? 'IN' : 'OUT'}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-white uppercase">{p.type.replace('_', ' ')}</p>
                                                <p className="text-[8px] font-mono text-gray-600">SEQ_IDENTIFIED_OK</p>
                                            </div>
                                        </div>
                                        <p className="text-lg font-black text-primary-500 italic tracking-tighter">{p.time}</p>
                                    </div>
                                )) : (
                                    <div className="py-12 text-center text-gray-700 italic text-[10px] font-black uppercase tracking-widest">Aguardando_Atividade</div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in pb-10">
                        <div className="bg-black/40 border border-white/5 p-6 shadow-2xl">
                            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full bg-white/5 border border-white/10 p-4 text-xs font-mono uppercase text-white outline-none focus:border-primary-500" />
                        </div>
                        <div className="space-y-4">
                            {[...new Set(historyData.map(d => d.date))].map(date => {
                                const dayLogs = historyData.filter(d => d.date === date);
                                const hasAprovedJustify = dayLogs.some(l => l.type === 'justificativa' && l.status === 'aprovado');

                                return (
                                    <div key={date} className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                                        <div className="bg-white/5 px-4 py-3 border-b border-white/5 flex justify-between items-center">
                                            <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">{date}</span>
                                            <div className="flex items-center gap-3">
                                                {hasAprovedJustify && <span className="text-[8px] bg-green-500 text-black px-1.5 font-black uppercase">Abonado</span>}
                                                <span className="text-[10px] font-black text-white italic">Carga: {dailyTotals[date] || '00h 00m'}</span>
                                            </div>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            {dayLogs.map(item => (
                                                <div key={item.id} className="flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${item.type === 'entrada' ? 'bg-primary-500' :
                                                                item.type === 'justificativa' ? 'bg-yellow-500' : 'bg-red-500'
                                                            }`}></div>
                                                        <p className="text-[10px] font-black text-gray-300 uppercase">{item.type.replace('_', ' ')}</p>
                                                    </div>
                                                    <p className="text-[10px] font-black text-primary-500 font-mono italic">
                                                        {item.type === 'justificativa' ? (item.status?.toUpperCase() || 'SENT') : item.time}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>

            {/* Modal: Justificação de Falta / Atestado */}
            {showJustificationModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-gray-900 border border-white/10 p-8 w-full max-w-md animate-fade-in relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-primary-500"></div>
                        <button onClick={() => setShowJustificationModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl font-bold p-2 z-10">×</button>
                        <h3 className="text-primary-500 font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><span className="text-lg">📝</span> Pedir Justificativa</h3>
                        <form onSubmit={handleJustificationSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Tipo de Ocorrência</label>
                                <select className="w-full bg-white/5 border border-white/10 p-4 text-xs text-white uppercase outline-none focus:border-primary-500" value={justificationData.type} onChange={e => setJustificationData({ ...justificationData, type: e.target.value })}>
                                    <option value="Atestado Médico">Atestado Médico</option>
                                    <option value="Atraso de Transporte">Atraso de Transporte</option>
                                    <option value="Serviço Externo">Serviço Externo</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Data do Ocorrido</label>
                                <input type="date" required className="w-full bg-white/5 border border-white/10 p-4 text-xs text-white outline-none focus:border-primary-500" value={justificationData.date} onChange={e => setJustificationData({ ...justificationData, date: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Observação</label>
                                <textarea placeholder="DESCREVA O MOTIVO..." className="w-full bg-white/5 border border-white/10 p-4 text-xs h-24 text-white uppercase outline-none focus:border-primary-500 resize-none" value={justificationData.obs} onChange={e => setJustificationData({ ...justificationData, obs: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Anexar Comprovante (Opcional)</label>
                                <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="w-full bg-white/5 border border-white/10 p-4 text-[10px] text-gray-400 file:bg-primary-500 file:text-black file:border-none file:px-4 file:py-1 file:mr-4 file:font-black file:uppercase cursor-pointer" />
                                {justificationData.file && <p className="text-[8px] text-primary-500 font-bold uppercase mt-1">✓ Arquivo carregado com sucesso</p>}
                            </div>
                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => setShowJustificationModal(false)} className="flex-1 py-4 border border-white/10 text-[10px] font-black uppercase">Cancelar</button>
                                <button type="submit" disabled={isSendingJustification} className="flex-1 py-4 bg-primary-500 text-black text-[10px] font-black uppercase hover:bg-primary-400 shadow-lg shadow-primary-500/20">{isSendingJustification ? 'Enviando...' : 'Enviar Pedido'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeDashboard;
