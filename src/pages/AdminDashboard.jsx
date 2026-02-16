import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

import { collection, getDocs, query, where, orderBy, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import InstallButton from '../components/InstallButton';
import { GREENHOUSE_LOCATION } from '../config/firebase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const AdminDashboard = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [employees, setEmployees] = useState([]);
    const [stats, setStats] = useState({ present: 0, justifications: 0, loading: true });
    const [recentLogs, setRecentLogs] = useState([]);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [newEmployee, setNewEmployee] = useState({ name: '', matricula: '', password: '', role: 'employee' });
    const [reportFilters, setReportFilters] = useState({
        start: new Date().toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
        employeeId: 'all'
    });
    const [reportData, setReportData] = useState([]);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [previewPhoto, setPreviewPhoto] = useState(null);
    const [geofence, setGeofence] = useState({
        latitude: GREENHOUSE_LOCATION.latitude,
        longitude: GREENHOUSE_LOCATION.longitude,
        radius: GREENHOUSE_LOCATION.radius,
        loading: true
    });
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // in metres
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch Geofence Settings
                const geoDoc = await getDoc(doc(db, 'settings', 'geofence'));
                if (geoDoc.exists()) {
                    setGeofence({ ...geoDoc.data(), loading: false });
                } else {
                    setGeofence(prev => ({ ...prev, loading: false }));
                }

                // Fetch Employees
                const empSnapshot = await getDocs(collection(db, 'users'));
                const empList = empSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setEmployees(empList);

                // Fetch Today's Punches for "Present Now"
                const today = new Date().toISOString().slice(0, 10);
                const punchQuery = query(collection(db, 'punches'), where('date', '==', today));
                const punchSnapshot = await getDocs(punchQuery);

                // Simple logic for present: unique userIds that have an 'entrada' today
                const presentUsers = new Set();
                punchSnapshot.docs.forEach(doc => {
                    const punch = doc.data();
                    if (punch.type === 'entrada') presentUsers.add(punch.userId);
                    // Could be refined to handle entry/exit pairs
                });

                // Fetch Recent Logs
                const recentQuery = query(collection(db, 'punches'), orderBy('timestamp', 'desc'), limit(5));
                const recentSnapshot = await getDocs(recentQuery);
                const logs = recentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setRecentLogs(logs);

                setStats({
                    present: presentUsers.size,
                    justifications: 0, // Need a collection for this
                    loading: false
                });

            } catch (error) {
                console.error("Erro ao buscar dados do dashboard:", error);
                setStats(prev => ({ ...prev, loading: false }));
            }
        };

        fetchDashboardData();
    }, [activeTab]);

    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        try {
            let q = query(
                collection(db, 'punches'),
                where('date', '>=', reportFilters.start),
                where('date', '<=', reportFilters.end),
                orderBy('date', 'desc'),
                orderBy('timestamp', 'asc')
            );

            if (reportFilters.employeeId !== 'all') {
                q = query(q, where('userId', '==', reportFilters.employeeId));
            }

            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReportData(data);
        } catch (error) {
            console.error("Erro ao gerar relatório:", error);
            alert("Erro ao gerar relatório. Verifique os critérios.");
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const calculateWorkedHoursSummary = (data) => {
        const groups = {};
        data.forEach(log => {
            const key = `${log.date}_${log.userId}`;
            if (!groups[key]) {
                groups[key] = { date: log.date, userName: log.userName, userId: log.userId, punches: [] };
            }
            groups[key].punches.push(log);
        });

        return Object.values(groups).map(group => {
            const sorted = group.punches.sort((a, b) => {
                const timeA = a.timestamp?.seconds || 0;
                const timeB = b.timestamp?.seconds || 0;
                return timeA - timeB;
            });
            let totalMs = 0;
            let lastIn = null;

            sorted.forEach(p => {
                if (p.type === 'entrada' || p.type === 'volta_almoco') {
                    lastIn = p.timestamp?.toDate ? p.timestamp.toDate() : new Date();
                } else if ((p.type === 'saida_almoco' || p.type === 'saida') && lastIn) {
                    const currentOut = p.timestamp?.toDate ? p.timestamp.toDate() : new Date();
                    totalMs += currentOut - lastIn;
                    lastIn = null;
                }
            });

            const totalHours = totalMs / (1000 * 60 * 60);
            return {
                ...group,
                totalHours,
                formatted: `${Math.floor(totalHours)}h ${Math.round((totalHours % 1) * 60)}m`
            };
        }).sort((a, b) => b.date.localeCompare(a.date));
    };

    const handleExportPDF = () => {
        const doc = jsPDF();
        const tableColumn = ["Data", "Funcionário", "Tipo", "Horário", "Distância"];
        const tableRows = [];

        reportData.forEach(log => {
            const dist = log.location ? calculateDistance(
                log.location.latitude,
                log.location.longitude,
                GREENHOUSE_LOCATION.latitude,
                GREENHOUSE_LOCATION.longitude
            ) : null;

            const rowData = [
                log.date,
                log.userName,
                log.type,
                log.timestamp?.toDate().toLocaleTimeString('pt-BR'),
                dist ? `${Math.round(dist)}m` : 'S/ GPS'
            ];
            tableRows.push(rowData);
        });

        doc.text("Relatório de Frequência - Sistema Ponto 🌱", 14, 15);
        doc.autoTable(tableColumn, tableRows, { startY: 20 });
        doc.save(`Relatorio_${reportFilters.start}_a_${reportFilters.end}.pdf`);
    };

    const handleExportCSV = () => {
        const headers = ["Data", "Funcionario", "Matricula", "Tipo", "Horário", "Distancia_m"];
        const rows = reportData.map(log => {
            const dist = log.location ? Math.round(calculateDistance(
                log.location.latitude,
                log.location.longitude,
                geofence.latitude,
                geofence.longitude
            )) : '';

            return [
                log.date,
                log.userName,
                log.matricula || '',
                log.type,
                log.timestamp?.toDate().toLocaleTimeString('pt-BR'),
                dist
            ].join(';');
        });

        const csvContent = [headers.join(';'), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Relatorio_${reportFilters.start}_a_${reportFilters.end}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Secondary App for User Creation (prevents logging out admin)
    const handleRegister = async (e) => {
        e.preventDefault();

        try {
            // Check if matricula already exists (simple client-side check from loaded list)
            if (employees.some(emp => emp.matricula === newEmployee.matricula)) {
                alert('Erro: Matrícula já existe!');
                return;
            }

            // We need a way to create a user without logging out.
            // In pure client-side Firebase, createUserWithEmailAndPassword signs in the new user immediately.
            // The workaround is to create a temporary secondary app instance.
            // However, initializing a second app with the same config often throws warnings or errors if not handled carefully.
            // A simpler, robust way for this MVP is to use a cloud function or backend api.
            // BUT, since we are frontend-only for now, let's use the secondary app trick carefully.

            // For now, let's try the standard way and handle the re-auth or use a second app instance.
            // Importing 'initializeApp' again to create a named app.

            const { initializeApp, getApp, getApps } = await import('firebase/app');
            const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');
            const { firebaseConfig } = await import('../config/firebase'); // ensure you export firebaseConfig
            const { doc, setDoc } = await import('firebase/firestore');

            const secondaryAppName = 'secondaryApp';
            let secondaryApp;

            if (getApps().some(app => app.name === secondaryAppName)) {
                secondaryApp = getApp(secondaryAppName);
            } else {
                secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
            }

            const secondaryAuth = getAuth(secondaryApp);

            // Create User in Auth
            const emailFake = `${newEmployee.matricula}@estufa.sistema`;
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailFake, newEmployee.password);
            const user = userCredential.user;

            // Create Profile in Firestore (using the main db instance is fine)
            await setDoc(doc(db, 'users', user.uid), {
                name: newEmployee.name,
                matricula: newEmployee.matricula,
                email: emailFake,
                role: newEmployee.role,
                createdAt: new Date().toISOString(),
                active: true
            });

            // Sign out the secondary auth immediatly so it doesn't interfere
            await signOut(secondaryAuth);

            alert('Funcionário cadastrado com sucesso! 🎉');
            setShowRegisterModal(false);
            setNewEmployee({ name: '', matricula: '', password: '', role: 'employee' });

            // Update List
            setEmployees(prev => [...prev, { id: user.uid, ...newEmployee, email: emailFake }]);

        } catch (error) {
            console.error("Erro ao cadastrar:", error);
            alert(`Erro ao cadastrar: ${error.message}`);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Erro ao sair:', error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 selection:bg-emerald-500/30 font-sans">
            {/* Background Decoration */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/20 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="relative z-10">
                {/* Register Modal */}
                {showRegisterModal && (
                    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md italic selection:bg-emerald-500/30">
                        <div className="bg-black/60 backdrop-blur-2xl border-2 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden animate-fade-in relative">
                            <div className="absolute top-0 right-0 p-2 opacity-20">
                                <div className="w-20 h-20 border-t border-r border-emerald-500"></div>
                            </div>

                            <div className="bg-emerald-500/10 px-8 py-5 border-b border-white/5 flex justify-between items-center text-white">
                                <div>
                                    <h3 className="font-black uppercase tracking-[0.3em] text-xs text-emerald-500">Novo_Registro_Operador</h3>
                                    <p className="text-[9px] font-mono text-emerald-500/40 uppercase mt-1">SISTEMA_IDENTIFICAÇÃO_V1.0</p>
                                </div>
                                <button onClick={() => setShowRegisterModal(false)} className="text-white/50 hover:text-emerald-500 font-bold text-2xl transition-colors">&times;</button>
                            </div>

                            <form onSubmit={handleRegister} className="p-8 space-y-6">
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Identificação_Nome</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="NOME COMPLETO"
                                            className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase"
                                            value={newEmployee.name}
                                            onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Matrícula_ID</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="0000"
                                                className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase tracking-widest"
                                                value={newEmployee.matricula}
                                                onChange={e => setNewEmployee({ ...newEmployee, matricula: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Chave_Acesso</label>
                                            <input
                                                type="password"
                                                required
                                                placeholder="******"
                                                className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white"
                                                value={newEmployee.password}
                                                onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Permissão_Sistema</label>
                                        <select
                                            className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase appearance-none cursor-pointer"
                                            value={newEmployee.role}
                                            onChange={e => setNewEmployee({ ...newEmployee, role: e.target.value })}
                                        >
                                            <option value="employee" className="bg-gray-900">OPERACIONAL (PADRÃO)</option>
                                            <option value="admin" className="bg-gray-900">ADMINISTRADOR (TOTAL)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4 border-t border-white/5">
                                    <button type="button" onClick={() => setShowRegisterModal(false)} className="flex-1 px-4 py-3 border border-white/10 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-white hover:border-white/30 transition-all">ABORTAR</button>
                                    <button type="submit" className="flex-1 px-4 py-3 bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg active:scale-95">CONFIRMAR_REGISTRO</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Photo Preview Modal */}
                {previewPhoto && (
                    <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 backdrop-blur-xl" onClick={() => setPreviewPhoto(null)}>
                        <div className="relative max-w-2xl w-full animate-fade-in" onClick={e => e.stopPropagation()}>
                            <div className="absolute top-0 left-0 w-full h-full border border-white/10 pointer-events-none"></div>
                            <img src={previewPhoto} className="w-full shadow-[0_0_100px_rgba(0,0,0,0.5)] border-4 border-black" alt="Preview facial" />
                            <div className="absolute top-4 right-4 flex gap-2">
                                <button
                                    onClick={() => setPreviewPhoto(null)}
                                    className="bg-black/50 hover:bg-black text-white w-10 h-10 flex items-center justify-center font-black text-xl border border-white/20 transition-all active:scale-95"
                                >
                                    &times;
                                </button>
                            </div>
                            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-4 py-2 border border-white/5">
                                <p className="text-[10px] font-mono text-emerald-500 font-black uppercase tracking-[0.2em]">Registro_Visual_Validado</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <header className="bg-black/40 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic">
                                    🌱 Sistema de <span className="text-emerald-500">Ponto</span>
                                </h1>
                                <p className="text-[10px] font-mono text-gray-400 mt-1 uppercase tracking-widest">
                                    Módulo_Administrativo // {currentUser?.name || 'ADMIN'}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <InstallButton />
                                <button
                                    onClick={handleLogout}
                                    className="px-6 py-2 bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white hover:border-red-500 transition-all active:scale-95 shadow-lg"
                                >
                                    SAIR
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Navigation Tabs */}
                <div className="bg-black/20 backdrop-blur-md border-b border-white/5 sticky top-[73px] z-30">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <nav className="flex space-x-8">
                            {[
                                { id: 'overview', label: 'Visão Geral', icon: '📊' },
                                { id: 'employees', label: 'Funcionários', icon: '👥' },
                                { id: 'reports', label: 'Relatórios', icon: '📋' },
                                { id: 'settings', label: 'Configurações', icon: '⚙️' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`py-4 px-1 border-b-2 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab.id
                                        ? 'border-emerald-500 text-emerald-500'
                                        : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
                                        }`}
                                >
                                    <span className="mr-2">{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Content */}
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex justify-between items-end">
                                <h2 className="text-2xl font-black text-white tracking-tight uppercase border-l-4 border-emerald-500 pl-4">
                                    Status da Operação
                                </h2>
                                <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                                    Live Update: {new Date().toLocaleTimeString()}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-6 shadow-2xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Funcionários Ativos</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black text-white">{employees.length}</span>
                                        <span className="text-[10px] font-bold text-emerald-500">UNIDADES</span>
                                    </div>
                                </div>

                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-6 shadow-2xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Presentes Agora</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black text-emerald-500">{stats.present}</span>
                                        <span className="text-[10px] font-bold text-emerald-500">EM CAMPO</span>
                                    </div>
                                </div>

                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-6 shadow-2xl border-l-orange-500">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Justificativas</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black text-orange-500">{stats.justifications}</span>
                                        <span className="text-[10px] font-bold text-orange-500">PENDENTES</span>
                                    </div>
                                </div>

                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-6 shadow-2xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Sincronização</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Estável</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 overflow-hidden shadow-2xl">
                                    <div className="bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-500 px-4 py-2 flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest">Últimas Ocorrências</span>
                                        <span className="text-[10px] font-mono opacity-50">LOG_SYSTEM_V.1.0</span>
                                    </div>
                                    <div className="p-0 divide-y divide-white/5">
                                        {recentLogs.length > 0 ? recentLogs.map(log => (
                                            <div key={log.id} className="px-4 py-3 hover:bg-white/5 flex items-center justify-between transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-1 h-8 ${log.type === 'entrada' ? 'bg-emerald-500' : 'bg-red-500/50'}`}></div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white uppercase tracking-tight">
                                                            {log.type === 'entrada' ? '🌅 Entrada' :
                                                                log.type === 'saida_almoco' ? '🍽️ Saída Almoço' :
                                                                    log.type === 'volta_almoco' ? '↩️ Volta Almoço' : '🌙 Saída'}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400 font-mono">
                                                            {log.userName} • {log.timestamp?.toDate().toLocaleTimeString('pt-BR')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`text-[9px] font-black uppercase tracking-tighter border px-2 py-0.5 ${log.location && calculateDistance(log.location.latitude, log.location.longitude, geofence.latitude, geofence.longitude) > geofence.radius
                                                    ? 'text-red-500 bg-red-500/10 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                                    : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                                                    }`}>
                                                    {log.location && calculateDistance(log.location.latitude, log.location.longitude, geofence.latitude, geofence.longitude) > geofence.radius ? 'FORA_PERÍMETRO' : 'OK'}
                                                </span>
                                            </div>
                                        )) : (
                                            <div className="p-12 text-center text-gray-600 font-mono text-xs uppercase italic tracking-widest">
                                                Nenhum registro recente detectado
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 overflow-hidden p-6 relative shadow-2xl">
                                    <div className="absolute top-0 right-0 p-4">
                                        <div className="w-12 h-12 border-t border-r border-emerald-500/20"></div>
                                    </div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/50 mb-6 italic">Acesso_Rápido // Operações</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button onClick={() => setActiveTab('reports')} className="group bg-white/5 border border-white/10 p-5 text-left hover:border-emerald-500/50 hover:bg-white/10 transition-all shadow-lg active:scale-95">
                                            <p className="text-2xl mb-2 group-hover:scale-110 transition-transform">📄</p>
                                            <p className="text-xs font-black text-white uppercase leading-none tracking-tight">Exportar Folha</p>
                                            <p className="text-[10px] text-gray-400 mt-2 font-mono uppercase tracking-widest">PDF_Download</p>
                                        </button>
                                        <button onClick={() => setShowRegisterModal(true)} className="group bg-white/5 border border-white/10 p-5 text-left hover:border-emerald-500/50 hover:bg-white/10 transition-all shadow-lg active:scale-95">
                                            <p className="text-2xl mb-2 group-hover:scale-110 transition-transform">➕</p>
                                            <p className="text-xs font-black text-white uppercase leading-none tracking-tight">Novo Registro</p>
                                            <p className="text-[10px] text-gray-400 mt-2 font-mono uppercase tracking-widest">Add_Employee</p>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'employees' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-white tracking-tight uppercase border-l-4 border-emerald-500 pl-4">
                                        Gestão de Colaboradores
                                    </h2>
                                </div>
                                <div className="flex w-full md:w-auto gap-3">
                                    <div className="relative flex-1 md:w-80">
                                        <input
                                            type="text"
                                            placeholder="BUSCAR POR NOME OU MATRÍCULA..."
                                            className="w-full bg-white/5 border border-white/10 p-3 pl-10 focus:border-emerald-500 focus:bg-white/10 outline-none font-mono text-[10px] uppercase tracking-widest text-white transition-all shadow-inner"
                                        />
                                        <svg className="w-4 h-4 absolute left-3 top-3.5 text-emerald-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                    <button
                                        onClick={() => setShowRegisterModal(true)}
                                        className="bg-emerald-500 text-black px-6 py-3 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all active:scale-95 whitespace-nowrap shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                    >
                                        + ADICIONAR
                                    </button>
                                </div>
                            </div>

                            {/* Employee List */}
                            <div className="bg-black/40 backdrop-blur-xl border border-white/5 shadow-2xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left font-mono text-[10px] uppercase tracking-wider">
                                        <thead>
                                            <tr className="bg-emerald-500/10 text-emerald-500 border-b border-white/5">
                                                <th className="px-6 py-4 font-black">Colaborador</th>
                                                <th className="px-6 py-4 font-black">Matrícula</th>
                                                <th className="px-6 py-4 font-black">Acesso</th>
                                                <th className="px-6 py-4 font-black">Status</th>
                                                <th className="px-6 py-4 text-right font-black">Ações_Auditoria</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-gray-300">
                                            {employees.map((emp) => (
                                                <tr key={emp.id} className="hover:bg-white/5 transition-colors group">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div className="h-10 w-10 border border-white/10 bg-white/5 text-gray-400 flex items-center justify-center font-black text-xl group-hover:border-emerald-500 group-hover:text-emerald-500 transition-all">
                                                                {emp.name?.charAt(0).toUpperCase() || 'U'}
                                                            </div>
                                                            <div className="ml-4">
                                                                <div className="text-sm font-black text-white uppercase tracking-tight italic">{emp.name}</div>
                                                                <div className="text-[9px] font-mono text-gray-600 opacity-50 uppercase tracking-widest">{emp.id.slice(0, 8)}...</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap focus:text-emerald-500">
                                                        <span className="text-xs text-emerald-500/70 font-mono tracking-widest">{emp.matricula}</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border transition-colors ${emp.role === 'admin' ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'border-white/10 text-gray-600'
                                                            }`}>
                                                            {emp.role === 'admin' ? 'Administrador' : 'Operacional'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
                                                            <span className="text-[9px] font-black text-emerald-500/80 uppercase tracking-widest">Sincronizado</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <div className="flex justify-end gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                title="Resetar Senha"
                                                                className="p-2 border border-white/10 hover:border-white/30 hover:bg-white/5 text-gray-400 transition-all"
                                                            >
                                                                🔑
                                                            </button>
                                                            <button
                                                                title="Desativar"
                                                                className="p-2 border border-white/10 hover:border-red-500/50 hover:bg-red-500/5 text-red-500/50 transition-all"
                                                            >
                                                                🚫
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {employees.length === 0 && (
                                                <tr>
                                                    <td colSpan="5" className="px-6 py-16 text-center text-gray-600 font-mono text-xs uppercase italic tracking-widest">
                                                        Nenhum perfil de operador detectado no sistema.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex justify-between items-end">
                                <h2 className="text-2xl font-black text-white tracking-tight uppercase border-l-4 border-emerald-500 pl-4">
                                    Relatórios de Ponto
                                </h2>
                            </div>

                            <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-8 shadow-2xl">
                                <div className="flex flex-col md:flex-row gap-6 mb-10 items-end">
                                    <div className="flex-1 space-y-2">
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Período_Selecionado</label>
                                        <div className="flex gap-4">
                                            <input
                                                type="date"
                                                value={reportFilters.start}
                                                onChange={(e) => setReportFilters(prev => ({ ...prev, start: e.target.value }))}
                                                className="flex-1 bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase"
                                            />
                                            <span className="flex items-center text-emerald-500/30">→</span>
                                            <input
                                                type="date"
                                                value={reportFilters.end}
                                                onChange={(e) => setReportFilters(prev => ({ ...prev, end: e.target.value }))}
                                                className="flex-1 bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase"
                                            />
                                        </div>
                                    </div>
                                    <div className="w-full md:w-72 space-y-2">
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Filtrar_Colaborador</label>
                                        <select
                                            value={reportFilters.employeeId}
                                            onChange={(e) => setReportFilters(prev => ({ ...prev, employeeId: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase appearance-none cursor-pointer"
                                        >
                                            <option value="all" className="bg-gray-900">TODOS OS COLABORADORES</option>
                                            {employees.map(e => (
                                                <option key={e.id} value={e.id} className="bg-gray-900">{e.name.toUpperCase()} ({e.matricula})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleGenerateReport}
                                        disabled={isGeneratingReport}
                                        className="bg-emerald-500 text-black py-[14px] w-full md:w-40 px-8 flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                                    >
                                        {isGeneratingReport ? (
                                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                        ) : 'FILTRAR_LOGS'}
                                    </button>
                                </div>

                                <div className="border-t border-white/5 pt-10 flex justify-between items-center mb-10">
                                    <div>
                                        <p className="text-[10px] font-black text-emerald-500/30 uppercase tracking-[0.3em]">Query_Response</p>
                                        <p className="text-sm font-mono text-white mt-1 uppercase tracking-tight">
                                            {reportData.length} registros sincronizados.
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleExportPDF}
                                            disabled={reportData.length === 0}
                                            className="px-6 py-2 border border-white/10 text-white text-[9px] font-black uppercase tracking-widest hover:bg-white/5 hover:border-white/30 transition-all disabled:opacity-20"
                                        >
                                            Exportar_PDF
                                        </button>
                                        <button
                                            onClick={handleExportCSV}
                                            disabled={reportData.length === 0}
                                            className="px-6 py-2 border border-white/10 text-white text-[9px] font-black uppercase tracking-widest hover:bg-white/5 hover:border-white/30 transition-all disabled:opacity-20"
                                        >
                                            CSV_EXCEL
                                        </button>
                                    </div>
                                </div>

                                {reportData.length > 0 ? (
                                    <div className="space-y-12">
                                        <div className="bg-emerald-500/5 p-8 border border-emerald-500/10 shadow-inner">
                                            <h3 className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                                Resumo de Horas_Líquidas
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {calculateWorkedHoursSummary(reportData).map((summary, idx) => (
                                                    <div key={idx} className="bg-black/20 p-5 border border-white/5 flex justify-between items-center shadow-lg group hover:border-emerald-500/30 transition-colors">
                                                        <div>
                                                            <p className="text-[9px] text-emerald-500/40 font-mono mb-1">{summary.date}</p>
                                                            <p className="text-white text-xs font-black truncate max-w-[150px] uppercase tracking-tighter">{summary.userName}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-emerald-500 text-xl font-black tracking-tighter">{summary.formatted}</p>
                                                            <p className="text-[8px] text-gray-600 uppercase font-black tracking-widest">Calculado</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto shadow-2xl">
                                            <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6 italic">Log_Detalhado_Full_Audit</h3>
                                            <table className="w-full text-left font-mono text-[9px] uppercase tracking-widest">
                                                <thead>
                                                    <tr className="bg-white/5 text-emerald-500/50">
                                                        <th className="px-5 py-4 font-black">Data_Stamp</th>
                                                        <th className="px-5 py-4 font-black">Operador</th>
                                                        <th className="px-5 py-4 font-black">Tipo_Alt</th>
                                                        <th className="px-5 py-4 font-black">Time_ISO</th>
                                                        <th className="px-5 py-4 font-black">Geofence (m)</th>
                                                        <th className="px-5 py-4 text-right font-black">Audit_Media</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-gray-400">
                                                    {reportData.map(log => (
                                                        <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                                                            <td className="px-5 py-4 font-black text-white">{log.date}</td>
                                                            <td className="px-5 py-4 text-emerald-500/60">{log.userName || 'N/A'}</td>
                                                            <td className="px-5 py-4">
                                                                <span className={`px-2 py-0.5 border text-[8px] font-black ${log.type === 'entrada' ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'border-white/10 text-gray-600'
                                                                    }`}>
                                                                    {log.type.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-4 font-black text-emerald-500">{log.timestamp?.toDate() ? log.timestamp.toDate().toLocaleTimeString('pt-BR') : '---'}</td>
                                                            <td className="px-5 py-4 italic">
                                                                {log.location ? (
                                                                    <div className="flex items-center gap-3">
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${calculateDistance(log.location.latitude, log.location.longitude, geofence.latitude, geofence.longitude) > geofence.radius ? 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'bg-emerald-500'}`}></span>
                                                                        <span>{Math.round(calculateDistance(log.location.latitude, log.location.longitude, geofence.latitude, geofence.longitude))}m</span>
                                                                    </div>
                                                                ) : '---'}
                                                            </td>
                                                            <td className="px-5 py-4 text-right">
                                                                {log.photo && (
                                                                    <button
                                                                        onClick={() => setPreviewPhoto(log.photo)}
                                                                        className="w-10 h-10 border border-white/10 hover:border-emerald-500/50 flex items-center justify-center transition-all group-hover:scale-110"
                                                                    >
                                                                        🖼️
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-black/20 border border-dashed border-white/5 py-24 text-center">
                                        <p className="text-6xl mb-6 opacity-10">📊</p>
                                        <p className="text-xs font-black text-gray-600 uppercase tracking-[0.4em] italic">
                                            {isGeneratingReport ? 'Synchronizing_Cloud_Data...' : 'Aguardando_Critérios_de_Busca'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'settings' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex justify-between items-end">
                                <h2 className="text-2xl font-black text-white tracking-tight uppercase border-l-4 border-emerald-500 pl-4">
                                    Configurações do Sistema
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-8 shadow-2xl space-y-8">
                                    <div>
                                        <h3 className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                            Perímetro de Geofencing
                                        </h3>
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Latitude_Centro</label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white"
                                                        value={geofence.latitude}
                                                        onChange={e => setGeofence({ ...geofence, latitude: parseFloat(e.target.value) })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Longitude_Centro</label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white"
                                                        value={geofence.longitude}
                                                        onChange={e => setGeofence({ ...geofence, longitude: parseFloat(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Raio_Tolerância (Metros)</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white"
                                                    value={geofence.radius}
                                                    onChange={e => setGeofence({ ...geofence, radius: parseInt(e.target.value) })}
                                                />
                                            </div>

                                            <div className="flex flex-col gap-3">
                                                <button
                                                    onClick={() => {
                                                        navigator.geolocation.getCurrentPosition(pos => {
                                                            setGeofence({
                                                                ...geofence,
                                                                latitude: pos.coords.latitude,
                                                                longitude: pos.coords.longitude
                                                            });
                                                        });
                                                    }}
                                                    className="w-full py-3 border border-emerald-500/30 text-emerald-500 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/10 transition-all flex items-center justify-center gap-2"
                                                >
                                                    📍 Capturar_Minha_Localização_Atual
                                                </button>

                                                <button
                                                    onClick={async () => {
                                                        setIsSavingSettings(true);
                                                        try {
                                                            await setDoc(doc(db, 'settings', 'geofence'), {
                                                                latitude: geofence.latitude,
                                                                longitude: geofence.longitude,
                                                                radius: geofence.radius,
                                                                updatedAt: new Date().toISOString()
                                                            });
                                                            alert('Configurações de Geofencing atualizadas com sucesso! ✅');
                                                        } catch (error) {
                                                            alert('Erro ao salvar: ' + error.message);
                                                        } finally {
                                                            setIsSavingSettings(false);
                                                        }
                                                    }}
                                                    disabled={isSavingSettings}
                                                    className="w-full bg-emerald-500 text-black py-4 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg flex items-center justify-center gap-2"
                                                >
                                                    {isSavingSettings ? 'Salvando...' : '💾 Salvar_Configurações_Globais'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-emerald-500/5 border border-emerald-500/10 p-8 shadow-inner">
                                    <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6 italic">Instruções_de_Configuração</h3>
                                    <div className="space-y-6 text-gray-400 font-mono text-[10px] uppercase tracking-widest leading-relaxed">
                                        <p>
                                            <span className="text-emerald-500 font-black">[!]</span> O Geofencing define a "Cerca Virtual" onde os colaboradores são autorizados a registrar o ponto.
                                        </p>
                                        <p>
                                            <span className="text-emerald-500 font-black">[!]</span> Batidas fora do raio definido serão marcadas com um alerta vermelho nos relatórios para auditoria.
                                        </p>
                                        <p>
                                            <span className="text-emerald-500 font-black">[!]</span> Para maior precisão, o administrador deve estar fisicamente no centro da estufa ao clicar em "CAPTURAR LOCALIZAÇÃO".
                                        </p>
                                        <div className="pt-6 border-t border-white/5">
                                            <p className="text-[8px] opacity-50">SISTEMA_V_1.0 // AUDIT_READY</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;
