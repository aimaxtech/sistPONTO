import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

import { collection, getDocs, query, where, orderBy, limit, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp as firestoreTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import InstallButton from '../components/InstallButton';
import { GREENHOUSE_LOCATION } from '../config/firebase';

// Novos Componentes Modulares
import OverviewTab from '../components/admin/OverviewTab';
import EmployeesTab from '../components/admin/EmployeesTab';
import ReportsTab from '../components/admin/ReportsTab';
import SettingsTab from '../components/admin/SettingsTab';

const AdminDashboard = () => {
    const { currentUser, userRole, currentCompany, setCurrentCompany, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');

    // Estados de UI e Modais
    const [showCompanySetup, setShowCompanySetup] = useState(false);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showPassResetModal, setShowPassResetModal] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [previewPhoto, setPreviewPhoto] = useState(null);

    // Dados de Formulário
    const [companyForm, setCompanyForm] = useState({
        name: '', cnpj: '', phone: '', address: '', workSchedule: 'monday_friday',
        latitude: '', longitude: '', radius: 100, workHours: 8, themeId: 'emerald', logoUrl: ''
    });
    const [newEmployee, setNewEmployee] = useState({ name: '', matricula: '', cpf: '', email: '', password: '', role: 'employee' });
    const [reportFilters, setReportFilters] = useState({
        start: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
        employeeId: 'all'
    });
    const [reportData, setReportData] = useState([]);
    const [recentLogs, setRecentLogs] = useState([]);
    const [weeklyStats, setWeeklyStats] = useState([]);
    const [stats, setStats] = useState({ present: 0, justifications: 0, loading: true });
    const [geofence, setGeofence] = useState({
        latitude: GREENHOUSE_LOCATION.latitude,
        longitude: GREENHOUSE_LOCATION.longitude,
        radius: GREENHOUSE_LOCATION.radius
    });

    const [employees, setEmployees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isRegisteringEmp, setIsRegisteringEmp] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [isResettingPass, setIsResettingPass] = useState(false);
    const [logoPreview, setLogoPreview] = useState(null);
    const [customColor, setCustomColor] = useState('#10b981');
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [statusData, setStatusData] = useState({ type: 'ativo', start: '', end: '' });
    const [auditLog, setAuditLog] = useState(null);
    const [auditReason, setAuditReason] = useState('');
    const [editData, setEditData] = useState({ type: '', time: '', date: '' });
    const [newPassForm, setNewPassForm] = useState({ password: '', confirm: '' });
    const [employeeBalances, setEmployeeBalances] = useState({});

    // Helpers
    const formatCPF = (v) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2').slice(0, 14);

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };

    const fetchEmployees = useCallback(async () => {
        if (!currentCompany?.id) return;
        try {
            const q = query(collection(db, 'users'), where('companyId', '==', currentCompany.id), where('role', '==', 'employee'));
            const snap = await getDocs(q);
            setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        } catch (error) { console.error(error); }
    }, [currentCompany?.id]);

    const fetchStats = useCallback(async () => {
        if (!currentCompany?.id) return;
        setStats(prev => ({ ...prev, loading: true }));
        try {
            const today = new Date().toISOString().split('T')[0];
            const q = query(collection(db, 'logs'), where('companyId', '==', currentCompany.id), where('date', '==', today));
            const snap = await getDocs(q);
            const logs = snap.docs.map(doc => doc.data());
            const uniquePresent = new Set(logs.filter(l => l.type === 'entrada').map(l => l.userId));
            setStats({ present: uniquePresent.size, justifications: logs.filter(l => l.justification).length, loading: false });

            const qRecent = query(collection(db, 'logs'), where('companyId', '==', currentCompany.id), orderBy('timestamp', 'desc'), limit(15));
            const snapRecent = await getDocs(qRecent);
            setRecentLogs(snapRecent.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // Gerar dados para o gráfico semanal
            const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
            const qWeekly = query(collection(db, 'logs'), where('companyId', '==', currentCompany.id), where('date', '>=', sevenDaysAgo));
            const snapWeekly = await getDocs(qWeekly);
            const weeklyLogs = snapWeekly.docs.map(d => d.data());

            const weekData = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
                const dayPresent = new Set(weeklyLogs.filter(l => l.date === date && l.type === 'entrada').map(l => l.userId)).size;
                weekData.push({ date: date.split('-').reverse().slice(0, 2).join('/'), count: dayPresent });
            }
            setWeeklyStats(weekData);

        } catch (error) { console.error(error); }
    }, [currentCompany?.id]);

    useEffect(() => {
        if (currentUser && userRole === 'admin') {
            fetchEmployees();
            fetchStats();
        }
    }, [currentUser, userRole, fetchEmployees, fetchStats]);

    // Banco de Horas Effect
    useEffect(() => {
        if (activeTab === 'employees' && currentCompany?.id && employees.length > 0) {
            const calculateBalances = async () => {
                const { calculateWorkedMinutes, calculateDailyBalance } = await import('../utils/timeUtils');
                const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                const q = query(collection(db, 'logs'), where('companyId', '==', currentCompany.id), where('date', '>=', startOfMonth));
                const snap = await getDocs(q);
                const allLogs = snap.docs.map(d => d.data());

                const balances = {};
                employees.forEach(emp => {
                    const empLogs = allLogs.filter(l => l.userId === emp.id);
                    const logsByDay = empLogs.reduce((acc, log) => { acc[log.date] = acc[log.date] || []; acc[log.date].push(log); return acc; }, {});
                    let totalBalance = 0;
                    Object.values(logsByDay).forEach(dayLogs => {
                        totalBalance += calculateDailyBalance(dayLogs, calculateWorkedMinutes(dayLogs), 8);
                    });
                    balances[emp.id] = totalBalance;
                });
                setEmployeeBalances(balances);
            };
            calculateBalances();
        }
    }, [activeTab, currentCompany?.id, employees]);

    const handleLogout = async () => { try { await logout(); navigate('/login'); } catch (e) { console.error(e); } };

    const handleSaveCompany = async (e) => {
        e.preventDefault();
        setIsSavingSettings(true);
        try {
            const loginCode = currentCompany?.loginCode || Math.random().toString(36).substring(2, 7).toUpperCase();
            const companyData = { ...companyForm, loginCode, latitude: parseFloat(companyForm.latitude), longitude: parseFloat(companyForm.longitude), radius: parseInt(companyForm.radius), workHours: parseInt(companyForm.workHours), updatedAt: firestoreTimestamp() };
            if (currentCompany?.id) {
                await updateDoc(doc(db, 'companies', currentCompany.id), companyData);
                setCurrentCompany({ ...currentCompany, ...companyData });
            } else {
                const docRef = await addDoc(collection(db, 'companies'), { ...companyData, ownerId: currentUser.uid, createdAt: firestoreTimestamp() });
                await updateDoc(doc(db, 'users', currentUser.uid), { companyId: docRef.id });
                setCurrentCompany({ id: docRef.id, ...companyData });
            }
            setShowCompanySetup(false); alert('Sucesso! ✅');
        } catch (e) { alert(e.message); } finally { setIsSavingSettings(false); }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setIsRegisteringEmp(true);
        try {
            const { initializeApp, getApps } = await import('firebase/app');
            const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');
            const { firebaseConfig } = await import('../config/firebase');
            const secondaryApp = getApps().find(a => a.name === 'secondary') || initializeApp(firebaseConfig, 'secondary');
            const secondaryAuth = getAuth(secondaryApp);
            const cpfClean = newEmployee.cpf.replace(/\D/g, '');
            const userCred = await createUserWithEmailAndPassword(secondaryAuth, `${cpfClean}@sisponto.com`, newEmployee.password);
            await setDoc(doc(db, 'users', userCred.user.uid), { uid: userCred.user.uid, name: newEmployee.name, matricula: newEmployee.matricula, cpf: cpfClean, role: newEmployee.role, companyId: currentCompany.id, status: 'ativo', createdAt: firestoreTimestamp() });
            await signOut(secondaryAuth);
            setShowRegisterModal(false); fetchEmployees(); alert('Cadastrado! ✅');
        } catch (e) { alert(e.message); } finally { setIsRegisteringEmp(false); }
    };

    const handleUpdateStatus = async (e) => {
        e.preventDefault();
        try {
            await updateDoc(doc(db, 'users', selectedEmp.id), { ...statusData, updatedAt: firestoreTimestamp() });
            setShowStatusModal(false); fetchEmployees(); alert('Status atualizado! ✅');
        } catch (e) { alert(e.message); }
    };

    const handleUpdateLog = async () => {
        if (!auditReason) return alert('Motivo obrigatório!');
        try {
            const [h, m] = editData.time.split(':');
            const newTs = new Date(editData.date + 'T' + h + ':' + m + ':00');
            await updateDoc(doc(db, 'logs', auditLog.id), { type: editData.type, date: editData.date, timestamp: newTs, lastEdit: { by: currentUser.uid, at: new Date().toISOString(), reason: auditReason } });
            setShowEditModal(false); handleGenerateReport(); alert('Atualizado! ✅');
        } catch (e) { alert(e.message); }
    };

    const handleDeleteLog = async () => {
        if (!auditReason) return alert('Motivo obrigatório!');
        try {
            await addDoc(collection(db, 'deleted_logs'), { ...auditLog, deletedBy: currentUser.uid, deletedAt: firestoreTimestamp(), reason: auditReason });
            await deleteDoc(doc(db, 'logs', auditLog.id));
            setShowDeleteConfirm(false); handleGenerateReport(); alert('Excluído! 🗑️');
        } catch (e) { alert(e.message); }
    };

    const handleCertificateUpload = async (logId, base64Data) => {
        try {
            await updateDoc(doc(db, 'logs', logId), { certificateUrl: base64Data, certificateUploadedAt: firestoreTimestamp() });
            setReportData(prev => prev.map(l => l.id === logId ? { ...l, certificateUrl: base64Data } : l));
            alert("Atestado anexado! 📄✅");
        } catch (e) { alert(e.message); }
    };

    const handleApproveJustification = async (logId) => {
        try {
            await updateDoc(doc(db, 'logs', logId), { status: 'aprovado', approvedBy: currentUser.uid, approvedAt: firestoreTimestamp() });
            setReportData(prev => prev.map(l => l.id === logId ? { ...l, status: 'aprovado' } : l));
            alert("Aprovado! As horas foram abonadas. ✅");
        } catch (e) { alert(e.message); }
    };

    const handleRejectJustification = async (logId) => {
        if (!window.confirm("Deseja realmente rejeitar esta justificativa?")) return;
        try {
            await updateDoc(doc(db, 'logs', logId), { status: 'rejeitado', rejectedBy: currentUser.uid, rejectedAt: firestoreTimestamp() });
            setReportData(prev => prev.map(l => l.id === logId ? { ...l, status: 'rejeitado' } : l));
            alert("Justificativa rejeitada. ❌");
        } catch (e) { alert(e.message); }
    };

    const handleGenerateReport = async () => {
        if (!currentCompany?.id) return;
        setIsGeneratingReport(true);
        try {
            let q = query(collection(db, 'logs'), where('companyId', '==', currentCompany.id), where('date', '>=', reportFilters.start), where('date', '<=', reportFilters.end), orderBy('date', 'desc'), orderBy('timestamp', 'desc'));
            const snap = await getDocs(q);
            let logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (reportFilters.employeeId !== 'all') logs = logs.filter(l => l.userId === reportFilters.employeeId);
            setReportData(logs);
        } catch (e) { console.error(e); } finally { setIsGeneratingReport(false); }
    };

    const handleResetPassword = (emp) => { setSelectedEmp(emp); setNewPassForm({ password: '', confirm: '' }); setShowPassResetModal(true); };
    const confirmManualPasswordReset = async (e) => {
        e.preventDefault();
        if (newPassForm.password !== newPassForm.confirm) return alert("Senhas não coincidem!");
        setIsResettingPass(true);
        try {
            await updateDoc(doc(db, 'users', selectedEmp.id), { passwordOverride: newPassForm.password, updatedAt: firestoreTimestamp() });
            alert('Senha redefinida! ✅'); setShowPassResetModal(false);
        } catch (e) { alert(e.message); } finally { setIsResettingPass(false); }
    };

    const handlePrepareAddEmployee = async () => {
        const q = query(collection(db, 'users'), where('companyId', '==', currentCompany.id), where('role', '==', 'employee'));
        const snap = await getDocs(q);
        setNewEmployee({ name: '', matricula: String(snap.docs.length + 1).padStart(4, '0'), cpf: '', email: '', password: '', role: 'employee' });
        setShowRegisterModal(true);
    };

    const handleDeleteEmployee = async (emp) => {
        if (!window.confirm(`Desativar ${emp.name}?`)) return;
        try {
            await updateDoc(doc(db, 'users', emp.id), { status: 'desativado', updatedAt: firestoreTimestamp() });
            fetchEmployees(); alert('Desativado! ✅');
        } catch (e) { alert(e.message); }
    };

    const renderTabContent = () => {
        const { formatMinutes } = require('../utils/timeUtils');
        switch (activeTab) {
            case 'overview': return <OverviewTab stats={stats} weeklyStats={weeklyStats} setActiveTab={setActiveTab} setShowRegisterModal={setShowRegisterModal} recentLogs={recentLogs} currentCompany={currentCompany} geofence={geofence} calculateDistance={calculateDistance} setPreviewPhoto={setPreviewPhoto} employees={employees} />;
            case 'employees': return <EmployeesTab searchTerm={searchTerm} setSearchTerm={setSearchTerm} onAddEmployee={handlePrepareAddEmployee} filteredEmployees={employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase())).map(e => ({ ...e, balanceStr: formatMinutes(employeeBalances[e.id] || 0) }))} employees={employees} formatCPF={formatCPF} setSelectedEmp={setSelectedEmp} setStatusData={setStatusData} setShowStatusModal={setShowStatusModal} handleResetPassword={handleResetPassword} handleDeleteEmployee={handleDeleteEmployee} />;
            case 'reports': return <ReportsTab reportFilters={reportFilters} setReportFilters={setReportFilters} employees={employees} handleGenerateReport={handleGenerateReport} isGeneratingReport={isGeneratingReport} reportData={reportData} geofence={geofence} calculateDistance={calculateDistance} setPreviewPhoto={setPreviewPhoto} handleAbonoToggle={() => { }} setAuditLog={setAuditLog} setEditData={setEditData} setShowEditModal={setShowEditModal} setShowDeleteConfirm={setShowDeleteConfirm} handleCertificateUpload={handleCertificateUpload} handleApproveJustification={handleApproveJustification} handleRejectJustification={handleRejectJustification} />;
            case 'settings': return <SettingsTab geofence={geofence} setGeofence={setGeofence} isSavingSettings={isSavingSettings} currentCompany={currentCompany} companyForm={companyForm} setCompanyForm={setCompanyForm} handleSaveCompany={handleSaveCompany} logoPreview={logoPreview} showColorPicker={showColorPicker} setShowColorPicker={setShowColorPicker} customColor={customColor} handleCustomColorChange={setCustomColor} />;
            default: return null;
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-primary-500/30">
            <nav className="sticky top-0 z-40 bg-black/60 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16 sm:h-20">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-primary-500 rounded-sm flex items-center justify-center rotate-3"><span className="text-black font-black text-xl">P.</span></div>
                            <h1 className="text-sm sm:text-2xl font-black uppercase italic">{currentCompany?.name || 'Sistema'} <span className="text-primary-500">Ponto</span></h1>
                        </div>
                        <button onClick={handleLogout} className="p-2 border border-white/10 hover:border-red-500/50 text-gray-400 hover:text-red-500 flex items-center gap-2">
                            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Sair</span><span>→</span>
                        </button>
                    </div>
                    <div className="flex gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
                        {[{ id: 'overview', label: 'Dashboard', icon: '📊' }, { id: 'employees', label: 'Equipe', icon: '👥' }, { id: 'reports', label: 'Relatórios', icon: '📄' }, { id: 'settings', label: 'Ajustes', icon: '⚙️' }].map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 py-4 border-b-2 transition-all ${activeTab === t.id ? 'border-primary-500 text-primary-500 font-black' : 'border-transparent text-gray-500'}`}>
                                <span>{t.icon}</span> <span className="text-[10px] sm:text-xs uppercase tracking-widest">{t.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">{renderTabContent()}</main>

            {/* Modal: Registro de Funcionário */}
            {showRegisterModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-gray-900 border border-white/10 p-8 w-full max-w-md animate-fade-in relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-primary-500"></div>
                        <button onClick={() => setShowRegisterModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl font-bold p-2 z-10 transition-colors">×</button>
                        <h3 className="text-primary-500 font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><span className="text-lg">⚡</span> Registro Operacional</h3>
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Nome Completo</label>
                                <input type="text" placeholder="EX: JOÃO SILVA" required className="w-full bg-white/5 border border-white/10 p-4 text-xs font-mono text-white outline-none focus:border-primary-500" value={newEmployee.name} onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value.toUpperCase() })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Documento CPF</label>
                                <input type="text" placeholder="000.000.000-00" required className="w-full bg-white/5 border border-white/10 p-4 text-sm font-mono text-white outline-none focus:border-primary-500" value={newEmployee.cpf} onChange={e => setNewEmployee({ ...newEmployee, cpf: formatCPF(e.target.value) })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Matrícula</label>
                                    <input type="text" readOnly className="w-full bg-white/5 border border-white/10 p-4 text-xs font-mono text-gray-400 cursor-not-allowed" value={newEmployee.matricula} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Senha Inicial</label>
                                    <input type="password" placeholder="******" required className="w-full bg-white/5 border border-white/10 p-4 text-xs font-mono text-white outline-none focus:border-primary-500" value={newEmployee.password} onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => setShowRegisterModal(false)} className="flex-1 py-4 border border-white/10 text-[10px] font-black uppercase hover:bg-white/5 transition-all">Abortar</button>
                                <button type="submit" disabled={isRegisteringEmp} className="flex-1 py-4 bg-primary-500 text-black text-[10px] font-black uppercase hover:bg-primary-400 shadow-lg shadow-primary-500/20">{isRegisteringEmp ? 'Processando...' : 'Confirmar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Status do Funcionário */}
            {showStatusModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-gray-900 border border-white/10 p-8 w-full max-w-md animate-fade-in relative">
                        <button onClick={() => setShowStatusModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl font-bold p-2 z-10">×</button>
                        <h3 className="text-primary-500 font-black uppercase tracking-widest mb-6">🗓️ Status de Operação</h3>
                        <form onSubmit={handleUpdateStatus} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase">Tipo de Status</label>
                                <select className="w-full bg-white/5 border border-white/10 p-4 text-xs text-white uppercase outline-none" value={statusData.type} onChange={e => setStatusData({ ...statusData, type: e.target.value })}>
                                    <option value="ativo" className="bg-gray-900">ATIVO / EM CAMPO</option>
                                    <option value="ferias" className="bg-gray-900">EM FÉRIAS</option>
                                    <option value="afastado" className="bg-gray-900">AFASTADO (MÉDICO/OUTROS)</option>
                                </select>
                            </div>
                            {statusData.type !== 'ativo' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="date" required className="bg-white/5 border border-white/10 p-4 text-xs" value={statusData.start} onChange={e => setStatusData({ ...statusData, start: e.target.value })} />
                                    <input type="date" required className="bg-white/5 border border-white/10 p-4 text-xs" value={statusData.end} onChange={e => setStatusData({ ...statusData, end: e.target.value })} />
                                </div>
                            )}
                            <button type="submit" className="w-full py-4 bg-primary-500 text-black font-black uppercase text-[10px]">Atualizar Status</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Editar Log */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-gray-900 border border-blue-500/30 p-8 w-full max-w-md animate-fade-in relative">
                        <button onClick={() => setShowEditModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl font-bold p-2 z-10">×</button>
                        <h3 className="text-blue-500 font-black uppercase tracking-widest mb-6">✏️ Ajuste de Registro</h3>
                        <div className="space-y-4">
                            <textarea required placeholder="MOTIVO DA ALTERAÇÃO (AUDITÁVEL)" className="w-full bg-white/5 border border-white/10 p-4 text-xs h-24 uppercase" value={auditReason} onChange={e => setAuditReason(e.target.value)} />
                            <div className="flex gap-2">
                                <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border border-white/10 text-xs font-black uppercase">Cancelar</button>
                                <button onClick={handleUpdateLog} className="flex-1 py-3 bg-blue-500 text-black text-xs font-black uppercase">Salvar Edição</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Deletar Log */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-gray-900 border border-red-500/30 p-8 w-full max-sm animate-fade-in relative">
                        <button onClick={() => setShowDeleteConfirm(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl font-bold p-2 z-10">×</button>
                        <h3 className="text-red-500 font-black uppercase tracking-widest mb-6">🗑️ Excluir Registro?</h3>
                        <div className="space-y-4">
                            <textarea required placeholder="JUSTIFICATIVA DE EXCLUSÃO" className="w-full bg-white/5 border border-white/10 p-4 text-xs h-24 uppercase" value={auditReason} onChange={e => setAuditReason(e.target.value)} />
                            <button onClick={handleDeleteLog} className="w-full py-3 bg-red-600 text-white text-xs font-black uppercase">Confirmar Exclusão</button>
                        </div>
                    </div>
                </div>
            )}

            {showPassResetModal && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-blue-500/30 p-8 w-full max-w-sm relative">
                        <button onClick={() => setShowPassResetModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl font-bold p-2 z-10">×</button>
                        <h3 className="text-blue-500 font-black uppercase text-xs mb-6 italic">🔒 Reset de Segurança // {selectedEmp?.name}</h3>
                        <form onSubmit={confirmManualPasswordReset} className="space-y-4">
                            <input type="password" placeholder="NOVA SENHA" required className="w-full bg-white/5 border border-white/10 p-4 text-xs" value={newPassForm.password} onChange={e => setNewPassForm({ ...newPassForm, password: e.target.value })} />
                            <input type="password" placeholder="CONFIRMAR SENHA" required className="w-full bg-white/5 border border-white/10 p-4 text-xs" value={newPassForm.confirm} onChange={e => setNewPassForm({ ...newPassForm, confirm: e.target.value })} />
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setShowPassResetModal(false)} className="flex-1 py-3 border border-white/10 text-[10px] font-black uppercase">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-blue-500 text-black text-[10px] font-black uppercase">Alterar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {previewPhoto && (
                <div className="fixed inset-0 bg-black/98 z-[60] flex flex-col items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewPhoto(null)}>
                    <div className="relative group max-w-4xl w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setPreviewPhoto(null)} className="absolute -top-10 right-0 text-white hover:text-primary-500 text-3xl font-bold">×</button>
                        <img src={previewPhoto} alt="Auditoria Digital" className="max-w-full max-h-[85vh] border-2 border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] object-contain" />
                        <div className="mt-6 flex gap-6">
                            <button onClick={() => setPreviewPhoto(null)} className="px-8 py-3 bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-500 transition-all">Fechar Preview</button>
                            <a href={previewPhoto} download="evidencia_ponto.png" className="px-8 py-3 bg-primary-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-primary-400 transition-all">Download Evidência</a>
                        </div>
                    </div>
                </div>
            )}

            {showCompanySetup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
                    <div className="bg-gray-900 border border-primary-500/30 w-full max-w-2xl p-10 rounded-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-24 h-24 bg-primary-500/10 -translate-x-12 -translate-y-12 rotate-45"></div>
                        <h2 className="text-2xl font-black text-white uppercase text-center mb-8 italic tracking-widest">⚡ Inicialização _Sistema</h2>
                        <form onSubmit={handleSaveCompany} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-primary-500/50 uppercase ml-2">Razão Social / Nome Fantasia</label>
                                <input type="text" required placeholder="NOME DA ORGANIZAÇÃO" className="w-full bg-white/5 border border-white/10 p-5 text-white font-mono uppercase focus:border-primary-500 outline-none" value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-primary-500/50 uppercase ml-2">CNPJ Identificador</label>
                                <input type="text" required placeholder="00.000.000/0000-00" className="w-full bg-white/5 border border-white/10 p-5 text-white font-mono focus:border-primary-500 outline-none" value={companyForm.cnpj} onChange={e => setCompanyForm({ ...companyForm, cnpj: e.target.value })} />
                            </div>
                            <button type="submit" disabled={isSavingSettings} className="w-full py-5 bg-primary-600 text-black font-black uppercase tracking-[0.3em] hover:bg-primary-500 shadow-2xl active:scale-95 transition-all">{isSavingSettings ? 'CONFIGURANDO...' : 'Finalizar Setup de Empresa'}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
