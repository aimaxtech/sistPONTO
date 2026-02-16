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
        <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 relative">
            {/* Justification Modal */}
            {showJustificationModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
                        <div className="bg-primary-600 px-4 py-3 flex justify-between items-center text-white">
                            <h3 className="font-bold">📝 Nova Justificativa</h3>
                            <button onClick={() => setShowJustificationModal(false)} className="text-white/80 hover:text-white">&times;</button>
                        </div>
                        <form onSubmit={handleJustificationSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                                <select className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                                    <option>Atestado Médico</option>
                                    <option>Atraso de Transporte</option>
                                    <option>Esquecimento</option>
                                    <option>Outros</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Data da Ocorrência</label>
                                <input type="date" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
                                <textarea className="w-full border rounded-lg p-2 text-sm h-24 focus:ring-2 focus:ring-primary-500 focus:outline-none placeholder-gray-400" placeholder="Descreva o motivo..."></textarea>
                            </div>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-gray-500 text-sm hover:bg-gray-50 cursor-pointer transition-colors">
                                📎 Anexar Documento (Foto/PDF)
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setShowJustificationModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm">Enviar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Header Mobile */}
            <header className="bg-white/10 backdrop-blur-sm border-b border-white/20 sticky top-0 z-10">
                <div className="max-w-md mx-auto px-4 py-4">
                    <div className="flex justify-between items-center text-white">
                        <div className="flex items-center gap-3">
                            {view === 'history' && (
                                <button
                                    onClick={() => setView('dashboard')}
                                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                            )}
                            <div>
                                <h1 className="text-xl font-bold">
                                    {view === 'history' ? '📜 Histórico' : '🌱 Sistema de Ponto'}
                                </h1>
                                <p className="text-sm text-white/80 mt-1">
                                    {view === 'history' ? 'Seus registros anteriores' : `Olá, ${currentUser?.name || 'Funcionário'}`}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 items-center">
                            <InstallButton />
                            <button
                                onClick={handleLogout}
                                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
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
                            <div className="card text-center p-4">
                                <div className="text-2xl mb-2">⏰</div>
                                <h2 className="text-sm font-bold text-gray-500 mb-1">Hora Atual</h2>
                                <p className="text-xl font-bold text-gray-900">
                                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <div className="card text-center p-4 relative overflow-hidden group hover:shadow-md transition-shadow">
                                <div className="absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <svg className="w-8 h-8 text-primary-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" /></svg>
                                </div>
                                <div className="text-2xl mb-2">⚖️</div>
                                <h2 className="text-sm font-bold text-gray-500 mb-1">Banco Horas</h2>
                                <p className="text-xl font-bold text-green-600">+ 02h 15m</p>
                            </div>
                        </div>

                        {/* Punch Button Component */}
                        <PunchButton />

                        {/* Actions Row */}
                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <button
                                onClick={() => setView('history')}
                                className="bg-white/10 backdrop-blur-md hover:bg-white/20 text-white p-4 rounded-xl text-center transition-all border border-white/10 flex flex-col items-center gap-2"
                            >
                                <span className="text-2xl">📜</span>
                                <span className="text-sm font-medium">Histórico</span>
                            </button>
                            <button
                                onClick={() => setShowJustificationModal(true)}
                                className="bg-white/10 backdrop-blur-md hover:bg-white/20 text-white p-4 rounded-xl text-center transition-all border border-white/10 flex flex-col items-center gap-2"
                            >
                                <span className="text-2xl">📝</span>
                                <span className="text-sm font-medium">Justificar</span>
                            </button>
                        </div>

                        {/* Today's Records */}
                        <div className="card mt-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                📋 Registros de Hoje
                            </h3>
                            <div className="space-y-3">
                                <div className="text-center py-8 text-gray-500">
                                    <p className="text-3xl mb-2">📭</p>
                                    <p className="text-sm">Nenhum registro ainda</p>
                                </div>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white">
                            <h4 className="font-semibold mb-2">ℹ️ Instruções</h4>
                            <ul className="text-sm space-y-1 text-white/90">
                                <li>• Ative a localização do seu dispositivo</li>
                                <li>• Registre entrada, saídas e retornos</li>
                                <li>• Acompanhe seu banco de horas diariamente</li>
                            </ul>
                        </div>
                    </>
                ) : (
                    <div className="space-y-6">
                        {/* Filters */}
                        <div className="card bg-white/95 backdrop-blur">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Selecione o Mês</label>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            />
                        </div>

                        {/* History List */}
                        <div className="space-y-4">
                            {/* Group by Date (Simple Mock Implementation) */}
                            {['15/02/2026', '14/02/2026'].map(date => (
                                <div key={date} className="card">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 border-b pb-2 flex justify-between items-center">
                                        {date}
                                        <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-1 rounded-full">8h trabalhadas</span>
                                    </h3>
                                    <div className="space-y-3">
                                        {historyData.filter(d => d.date === date).map((record, index) => (
                                            <div key={index} className="flex justify-between items-center text-sm group">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-2 h-2 rounded-full ${record.type === 'entrada' ? 'bg-green-500' :
                                                        record.type.includes('saida') ? 'bg-red-500' : 'bg-yellow-500'
                                                        }`}></span>
                                                    <div>
                                                        <p className="font-medium text-gray-900 capitalize leading-none">
                                                            {record.type.replace('_', ' ')}
                                                        </p>
                                                        <p className="text-xs text-gray-400 mt-1">{record.location}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-100">{record.time}</span>
                                                    <button
                                                        onClick={() => handleDownloadReceipt(record)}
                                                        className="text-gray-300 hover:text-primary-600 transition-colors p-1"
                                                        title="Baixar Comprovante"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <button className="w-full py-3 text-center text-white/80 hover:text-white text-sm font-medium transition-colors">
                                Carregar mais registros...
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default EmployeeDashboard;
