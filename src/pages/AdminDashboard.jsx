import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

import { collection, getDocs, query, where, orderBy, limit, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp as firestoreTimestamp } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import InstallButton from '../components/InstallButton';
import { GREENHOUSE_LOCATION } from '../config/firebase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const AdminDashboard = () => {
    const { currentUser, userRole, currentCompany, setCurrentCompany, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');

    // Se não tiver empresa vinculada, força o setup
    const [showCompanySetup, setShowCompanySetup] = useState(false);

    // Dados para criar/editar empresa
    const [companyForm, setCompanyForm] = useState({
        name: '',
        cnpj: '',
        phone: '',
        address: '',
        workSchedule: 'monday_friday',
        latitude: '',
        longitude: '',
        radius: 100,
        workHours: 8
    });

    useEffect(() => {
        // Lógica Rigorosa de Setup:
        // 1. Se não tem empresa vinculada -> Setup
        // 2. Se tem empresa, mas está incompleta (sem CNPJ ou LoginCode) -> Setup

        const isCompanyIncomplete = currentCompany && (!currentCompany.cnpj || !currentCompany.loginCode || !currentCompany.name);
        const hasNoCompany = currentUser && userRole === 'admin' && !currentUser.companyId && !currentCompany;

        if (hasNoCompany || isCompanyIncomplete) {
            setShowCompanySetup(true);
        } else {
            setShowCompanySetup(false);
        }

        if (currentCompany) {
            // Preencher formulário com o que já existe
            setCompanyForm({
                name: currentCompany.name || '',
                cnpj: currentCompany.cnpj || '',
                phone: currentCompany.phone || '',
                address: currentCompany.address || '',
                latitude: currentCompany.location?.latitude || '',
                longitude: currentCompany.location?.longitude || '',
                radius: currentCompany.radius || 100,
                workHours: currentCompany.workHours || 8,
                workSchedule: currentCompany.workSchedule || 'monday_friday'
            });
        }
    }, [currentUser, currentCompany, userRole]);

    const [employees, setEmployees] = useState([]);
    // Helper: Gerar código da empresa (5 dígitos baseados em timestamp para unicidade)
    const generateCompanyCode = () => {
        return Date.now().toString().slice(-5);
    };

    // Helper: Formata CNPJ (00.000.000/0000-00)
    const formatCNPJ = (value) => {
        return value
            .replace(/\D/g, '')
            .replace(/^(\d{2})(\d)/, '$1.$2')
            .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1/$2')
            .replace(/(\d{4})(\d)/, '$1-$2')
            .slice(0, 18);
    };

    // Helper: Valida CNPJ (Matemática Real)
    const validateCNPJ = (cnpj) => {
        cnpj = cnpj.replace(/[^\d]+/g, '');
        if (cnpj === '') return false;
        if (cnpj.length !== 14) return false;

        // Elimina CNPJs invalidos conhecidos
        if (/^(\d)\1+$/.test(cnpj)) return false;

        // Valida DVs
        let tamanho = cnpj.length - 2;
        let numeros = cnpj.substring(0, tamanho);
        let digitos = cnpj.substring(tamanho);
        let soma = 0;
        let pos = tamanho - 7;
        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }
        let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado !== parseInt(digitos.charAt(0))) return false;

        tamanho = tamanho + 1;
        numeros = cnpj.substring(0, tamanho);
        soma = 0;
        pos = tamanho - 7;
        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }
        resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado !== parseInt(digitos.charAt(1))) return false;

        return true;
    };

    // Helper: Formata CPF (000.000.000-00)
    const formatCPF = (value) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1-$2')
            .slice(0, 14);
    };

    // Helper: Valida CPF (Matemática Real)
    const validateCPF = (cpf) => {
        cpf = cpf.replace(/[^\d]+/g, '');
        if (cpf === '' || cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
        let soma = 0;
        let resto;
        for (let i = 1; i <= 9; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
        resto = (soma * 10) % 11;
        if ((resto === 10) || (resto === 11)) resto = 0;
        if (resto !== parseInt(cpf.substring(9, 10))) return false;
        soma = 0;
        for (let i = 1; i <= 10; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
        resto = (soma * 10) % 11;
        if ((resto === 10) || (resto === 11)) resto = 0;
        if (resto !== parseInt(cpf.substring(10, 11))) return false;
        return true;
    };

    const handleSaveCompany = async (e) => {
        e.preventDefault();

        // Validação CNPJ
        if (!validateCNPJ(companyForm.cnpj)) {
            alert("⚠️ CNPJ Inválido! Verifique os números digitados.");
            return; // Bloqueia o salvamento
        }

        setIsSavingSettings(true);

        try {
            // Gerar ou manter código de login da empresa
            const loginCode = currentCompany?.loginCode || generateCompanyCode();

            const companyData = {
                name: companyForm.name,
                cnpj: companyForm.cnpj || '',
                phone: companyForm.phone || '',
                address: companyForm.address || '',
                workSchedule: companyForm.workSchedule || 'monday_friday', // Save schedule
                loginCode: loginCode, // Salvar código para login dos funcionários
                location: {
                    latitude: parseFloat(companyForm.latitude),
                    longitude: parseFloat(companyForm.longitude)
                },
                radius: parseInt(companyForm.radius),
                workHours: parseInt(companyForm.workHours),
                ownerId: currentUser.uid,
                updatedAt: firestoreTimestamp()
            };

            if (currentCompany && currentCompany.id) {
                // Atualizar existente
                const companyRef = doc(db, 'companies', currentCompany.id);
                await updateDoc(companyRef, companyData);

                setCurrentCompany({ id: currentCompany.id, ...companyData });
                alert('Configurações da empresa atualizadas com sucesso!');
            } else {
                // Criar nova
                const docRef = await addDoc(collection(db, 'companies'), {
                    ...companyData,
                    createdAt: firestoreTimestamp()
                });

                // Vincular ao Admin
                const userRef = doc(db, 'users', currentUser.uid);
                await updateDoc(userRef, { companyId: docRef.id });

                setCurrentCompany({ id: docRef.id, ...companyData });
                setShowCompanySetup(false);
                alert(`Organização criada! O código da sua empresa é: ${loginCode}`);
            }
        } catch (error) {
            console.error("Erro ao salvar empresa:", error);
            alert("Erro ao salvar dados da empresa: " + error.message);
        } finally {
            setIsSavingSettings(false);
        }
    };

    const [stats, setStats] = useState({ present: 0, justifications: 0, loading: true });
    const [recentLogs, setRecentLogs] = useState([]);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [newEmployee, setNewEmployee] = useState({ name: '', matricula: '', cpf: '', email: '', password: '', role: 'employee' });
    const [reportFilters, setReportFilters] = useState({
        start: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
        end: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
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

    // Audit Actions States
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [auditLog, setAuditLog] = useState(null);
    const [auditReason, setAuditReason] = useState('');
    const [editData, setEditData] = useState({ type: '', time: '', date: '' });

    // Status Management States
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [statusData, setStatusData] = useState({ type: 'ativo', start: '', end: '' });
    const [selectedEmp, setSelectedEmp] = useState(null);

    // Manual Password Reset States
    const [showPassResetModal, setShowPassResetModal] = useState(false);
    const [newPassForm, setNewPassForm] = useState({ password: '', confirm: '' });
    const [isResettingPass, setIsResettingPass] = useState(false);

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

    // Movemos fetchEmployees para fora para ser reutilizável
    const fetchEmployees = async () => {
        if (!currentCompany?.id) {
            setEmployees([]);
            return;
        }
        try {
            console.log("🔍 Buscando funcionários para empresa:", currentCompany.id);
            const q = query(
                collection(db, 'users'),
                where('companyId', '==', currentCompany.id),
                where('role', '==', 'employee')
            );
            const querySnapshot = await getDocs(q);
            const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Ordenar na memória
            const sortedUsers = users.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            // Filter only active employees (não desativados)
            const onlyEmployees = sortedUsers.filter(u => u.status !== 'desativado');
            console.log("✅ Funcionários encontrados:", onlyEmployees.length);
            setEmployees(onlyEmployees);
        } catch (error) {
            console.error("❌ Erro ao buscar funcionários:", error);
            setEmployees([]);
            alert("Erro ao carregar lista de funcionários.");
        }
    };

    // Filtro de busca local
    const [searchTerm, setSearchTerm] = useState('');
    const filteredEmployees = employees.filter(emp =>
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.cpf?.includes(searchTerm)
    );

    const handleResetPassword = (emp) => {
        setSelectedEmp(emp);
        setNewPassForm({ password: '', confirm: '' });
        setShowPassResetModal(true);
    };

    const confirmManualPasswordReset = async (e) => {
        e.preventDefault();
        if (newPassForm.password !== newPassForm.confirm) {
            alert("❌ As senhas não coincidem!");
            return;
        }
        if (newPassForm.password.length < 6) {
            alert("❌ A senha deve ter no mínimo 6 caracteres!");
            return;
        }

        setIsResettingPass(true);
        try {
            const userRef = doc(db, 'users', selectedEmp.id);
            // Salvamos a senha em um campo fixo para contornar a limitação do Firebase Client SDK
            // No login, verificaremos este campo.
            await updateDoc(userRef, {
                passwordOverride: newPassForm.password,
                updatedAt: firestoreTimestamp()
            });

            alert(`✅ Senha do colaborador "${selectedEmp.name}" alterada com sucesso!`);
            setShowPassResetModal(false);
        } catch (error) {
            console.error("Erro ao resetar senha:", error);
            alert("❌ Erro ao salvar nova senha: " + error.message);
        } finally {
            setIsResettingPass(false);
        }
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!currentUser) return;

            setStats(prev => ({ ...prev, loading: true }));
            try {
                // Fetch Geofence Settings (Agora vem do currentCompany, não do banco global)
                if (currentCompany && currentCompany.location) {
                    setGeofence({
                        latitude: currentCompany.location.latitude,
                        longitude: currentCompany.location.longitude,
                        radius: currentCompany.radius || 100,
                        loading: false
                    });
                }

                // Fetch data only if company is loaded
                if (currentCompany) {
                    fetchEmployees();

                    // Buscar reports/stats apenas da empresa atual
                    // Como punches não tem companyId por enquanto (migração), filtramos pelos users
                    // Mas para dashboard rápido, vamos assumir que o admin só vê dados se filtrar

                    // Fetch Today's Punches for Stats
                    // Precisamos filtrar por usuários da empresa
                    // Para simplificar: buscar punches de hoje e filtrar na memória pelos employees.id

                    const now = new Date();
                    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                    // Melhor: buscar punches onde userId IN [lista_de_ids_da_empresa]
                    // Mas 'in' queries tem limite de 10.
                    // Abordagem escalável: Buscar todos punches do dia e filtrar os que user.companyId == current
                    // (Isso requer join, firebase não faz).
                    // Abordagem atual: Buscar todos os punches (se for pouco) ou filtrar por Admin?
                    // Vamos manter simples: Mostrar stats zerado até implementar filtro robusto no backend
                    // Ou fazer query por userId se for poucos employees.

                    // Solução Temporária Eficiente:
                    // Buscar 'punches' where 'date' == today. 
                    // Depois filtrar no cliente cruzando com a lista de funcionários 'employees'

                    const punchQuery = query(collection(db, 'punches'), where('date', '==', today));
                    const punchSnapshot = await getDocs(punchQuery);

                    // Precisamos da lista de IDs dos funcionários desta empresa
                    // Como fetchEmployees é async e setEmployees é assíncrono, talvez employees esteja vazio aqui
                    // Vamos fazer uma busca rápida de IDs ou confiar que o fluxo seguinte resolve

                    const companyUserDocs = await getDocs(query(collection(db, 'users'), where('companyId', '==', currentCompany.id)));
                    const companyUserIds = new Set(companyUserDocs.docs.map(d => d.id));

                    const presentUsers = new Set();
                    let eventualCount = 0;
                    let pendingJustifications = 0;

                    punchSnapshot.docs.forEach(doc => {
                        const punch = doc.data();
                        // Só conta se o usuário for da empresa
                        if (companyUserIds.has(punch.userId)) {
                            if (punch.type === 'entrada') presentUsers.add(punch.userId);
                            if (punch.type === 'saida_eventual') eventualCount++;
                            if (punch.type === 'saida_eventual' && !punch.isAbonado) pendingJustifications++;
                        }
                    });

                    setStats({
                        present: presentUsers.size,
                        eventuals: eventualCount,
                        pending: pendingJustifications,
                        loading: false
                    });

                    // Fetch Recent Logs - FILTRADO POR COMPANY
                    // Como punches não tem companyId, buscamos os últimos 50 e filtramos em memória
                    const recentQuery = query(collection(db, 'punches'), orderBy('timestamp', 'desc'), limit(50));
                    const recentSnapshot = await getDocs(recentQuery);
                    const logs = recentSnapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(log => companyUserIds.has(log.userId))
                        .slice(0, 5); // Pega apenas os 5 mais recentes da empresa

                    setRecentLogs(logs);
                } else {
                    setStats(prev => ({ ...prev, loading: false }));
                }

            } catch (error) {
                console.error("Erro dashboard:", error);
                setStats(prev => ({ ...prev, loading: false }));
            }
        };

        fetchDashboardData();
    }, [activeTab, currentCompany, currentUser]); // Re-run when company loads

    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        try {
            let q;
            let allDocs = [];

            if (reportFilters.employeeId !== 'all') {
                // Se filtramos por funcionário, pegamos todos dele e filtramos data na memória
                q = query(collection(db, 'punches'), where('userId', '==', reportFilters.employeeId));
                const snap = await getDocs(q);
                allDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(p => p.date >= reportFilters.start && p.date <= reportFilters.end);
            } else {
                // Se filtramos por clínica toda, pegamos por data
                q = query(
                    collection(db, 'punches'),
                    where('date', '>=', reportFilters.start),
                    where('date', '<=', reportFilters.end)
                );
                const snap = await getDocs(q);

                // FILTRO DE SEGURANÇA: Garantir que só apareçam dados da empresa logada
                // Precisamos da lista de IDs da empresa
                const companyUserDocs = await getDocs(query(collection(db, 'users'), where('companyId', '==', currentCompany.id)));
                const validIds = new Set(companyUserDocs.docs.map(d => d.id));

                allDocs = snap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(p => validIds.has(p.userId));
            }

            // Ordenar por data (desc) e depois por timestamp (asc) em JavaScript
            const sortedData = allDocs.sort((a, b) => {
                // Primeiro por data decrescente
                if (a.date !== b.date) {
                    return b.date.localeCompare(a.date);
                }
                const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.offlineTimestamp || 0);
                const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.offlineTimestamp || 0);
                return timeA - timeB;
            });

            setReportData(sortedData);
        } catch (error) {
            console.error("Erro ao gerar relatório:", error);
            alert("Erro ao gerar relatório. Verifique sua conexão ou os filtros selecionados.");
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const calculateHoursForDay = (punches) => {
        let totalMs = 0;
        const sorted = punches.sort((a, b) => {
            const tA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date();
            const tB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date();
            return tA - tB;
        });

        let lastIn = null;
        sorted.forEach((p, idx) => {
            if (p.type === 'entrada' || p.type === 'volta_almoco' || p.type === 'volta_eventual') {
                lastIn = p.timestamp?.toDate ? p.timestamp.toDate() : new Date();
            } else if ((p.type === 'saida_almoco' || p.type === 'saida' || p.type === 'saida_eventual') && lastIn) {
                const currentOut = p.timestamp?.toDate ? p.timestamp.toDate() : new Date();
                totalMs += currentOut - lastIn;
                lastIn = null;
            }

            // LÓGICA DE ABONO: Se o admin abonou a saída eventual, o tempo de intervalo é somado como trabalhado
            if (p.type === 'saida_eventual' && p.isAbonado) {
                const nextReturn = sorted.find((next, nIdx) => nIdx > idx && next.type === 'volta_eventual');
                if (nextReturn) {
                    const startAbo = p.timestamp?.toDate ? p.timestamp.toDate() : new Date();
                    const endAbo = nextReturn.timestamp?.toDate ? nextReturn.timestamp.toDate() : new Date();
                    totalMs += (endAbo - startAbo);
                }
            }
        });

        const diffHrs = Math.floor(totalMs / 3600000);
        const diffMins = Math.round((totalMs % 3600000) / 60000);
        return `${String(diffHrs).padStart(2, '0')}:${String(diffMins).padStart(2, '0')}`;
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
            const formattedTime = calculateHoursForDay(group.punches);
            return {
                ...group,
                formatted: formattedTime
            };
        }).sort((a, b) => b.date.localeCompare(a.date));
    };

    const handleAbonoToggle = async (log) => {
        if (log.type !== 'saida_eventual') return;
        try {
            await updateDoc(doc(db, 'punches', log.id), {
                isAbonado: !log.isAbonado,
                abonadoBy: currentUser.uid,
                abonadoAt: firestoreTimestamp()
            });
            handleGenerateReport(); // Atualiza a visualização
            alert(log.isAbonado ? 'Abono removido.' : 'Saída eventual abonada com sucesso! ✅');
        } catch (error) {
            alert('Erro ao abonar: ' + error.message);
        }
    };

    const handleExportPDF = () => {
        const doc = jsPDF();
        const tableColumn = ["Data", "Funcionário", "Tipo", "Horário", "Distância"];
        const tableRows = [];

        reportData.forEach(log => {
            const dist = log.location ? calculateDistance(
                log.location.latitude,
                log.location.longitude,
                geofence.latitude,
                geofence.longitude
            ) : null;

            // Tratamento robusto para registros online/offline
            const ts = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.offlineTimestamp || Date.now());
            const timeStr = ts.toLocaleTimeString('pt-BR');

            const rowData = [
                log.date,
                log.userName || 'N/A',
                log.type.toUpperCase(),
                timeStr,
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

            const ts = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.offlineTimestamp || Date.now());
            const timeStr = ts.toLocaleTimeString('pt-BR');

            return [
                log.date,
                log.userName || 'N/A',
                log.matricula || '',
                log.type.toUpperCase(),
                timeStr,
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

    const [isRegisteringEmp, setIsRegisteringEmp] = useState(false);

    // Secondary App for User Creation (prevents logging out admin)
    const handleRegister = async (e) => {
        e.preventDefault();
        setIsRegisteringEmp(true);

        try {
            // 1. Verificação Rigorosa no Firestore (não apenas no estado local)
            // Agora verificamos pelo CPF pois ele é o ID global de login
            const q = query(
                collection(db, 'users'),
                where('cpf', '==', newEmployee.cpf.replace(/\D/g, ''))
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const existingUser = querySnapshot.docs[0];
                const existingData = existingUser.data();

                if (existingData.status === 'desativado') {
                    // Garantir que temos uma matrícula para exibir/usar, recalculando se necessário
                    let matriculaParaReativar = newEmployee.matricula;
                    if (!matriculaParaReativar || matriculaParaReativar === '0000') {
                        const qCount = query(collection(db, 'users'), where('companyId', '==', currentCompany.id), where('role', '==', 'employee'));
                        const snapCount = await getDocs(qCount);
                        matriculaParaReativar = String(snapCount.docs.length + 1).padStart(4, '0');
                    }

                    if (window.confirm(`📋 O colaborador "${existingData.name}" (CPF ${newEmployee.cpf}) possui um perfil desativado.\n\nDeseja REATIVAR este perfil com a nova matrícula (${matriculaParaReativar})?`)) {
                        await updateDoc(doc(db, 'users', existingUser.id), {
                            name: newEmployee.name,
                            matricula: matriculaParaReativar,
                            passwordOverride: newEmployee.password,
                            status: 'ativo',
                            updatedAt: firestoreTimestamp()
                        });
                        alert('✅ Colaborador reativado com sucesso!');
                        setShowRegisterModal(false);
                        setNewEmployee({ name: '', matricula: '', cpf: '', email: '', password: '', role: 'employee' });
                        fetchEmployees();
                        setIsRegisteringEmp(false);
                        return;
                    } else {
                        setIsRegisteringEmp(false);
                        return;
                    }
                }

                alert(`⚠️ Erro: O CPF ${newEmployee.cpf} já está vinculado a um colaborador ativo.`);
                setIsRegisteringEmp(false);
                return;
            }

            // Validação de CPF antes de prosseguir
            if (!validateCPF(newEmployee.cpf)) {
                alert("⚠️ CPF Inválido! Verifique os números digitados.");
                setIsRegisteringEmp(false);
                return;
            }

            // Removidos imports dinâmicos redundantes que causavam erro de inicialização (TDZ)
            const { initializeApp, getApp, getApps } = await import('firebase/app');
            const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');
            const { firebaseConfig } = await import('../config/firebase');

            const secondaryAppName = 'secondaryApp';
            let secondaryApp;

            if (getApps().some(app => app.name === secondaryAppName)) {
                secondaryApp = getApp(secondaryAppName);
            } else {
                secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
            }

            const secondaryAuth = getAuth(secondaryApp);

            // Create User in Auth
            const cpfClean = newEmployee.cpf.replace(/\D/g, '');
            const emailFake = `${cpfClean}@sisponto.com`;

            try {
                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailFake, newEmployee.password);
                const user = userCredential.user;

                // Create Profile in Firestore
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    name: newEmployee.name,
                    matricula: newEmployee.matricula,
                    cpf: cpfClean,
                    personalEmail: newEmployee.email || '',
                    companyLoginCode: currentCompany.loginCode,
                    email: emailFake,
                    role: newEmployee.role,
                    companyId: currentCompany.id,
                    createdAt: firestoreTimestamp(),
                    status: 'ativo'
                });

                await signOut(secondaryAuth);
                alert('✅ Funcionário cadastrado com sucesso!');
                setShowRegisterModal(false);
                setNewEmployee({ name: '', matricula: '', cpf: '', email: '', password: '', role: 'employee' });
                fetchEmployees();

            } catch (authError) {
                console.error("Erro ao criar/autenticar:", authError);

                if (authError.code === 'auth/email-already-in-use') {
                    if (window.confirm("⚠️ Este CPF já tem um acesso criado no servidor, mas o perfil no banco de dados não foi encontrado.\n\nDeseja restaurar o perfil deste colaborador agora?")) {
                        try {
                            const tempId = `restored_${cpfClean}`;
                            await setDoc(doc(db, 'users', tempId), {
                                uid: tempId,
                                name: newEmployee.name,
                                matricula: newEmployee.matricula,
                                cpf: cpfClean,
                                personalEmail: newEmployee.email || '',
                                companyLoginCode: currentCompany.loginCode,
                                email: emailFake,
                                role: newEmployee.role,
                                companyId: currentCompany.id,
                                createdAt: firestoreTimestamp(),
                                status: 'ativo',
                                isRestored: true
                            });
                            alert('✅ Perfil restaurado com sucesso!');
                            setShowRegisterModal(false);
                            setNewEmployee({ name: '', matricula: '', cpf: '', email: '', password: '', role: 'employee' });
                            fetchEmployees();
                            return;
                        } catch (e) {
                            alert("Erro ao restaurar: " + e.message);
                        }
                    }
                } else {
                    alert('Erro ao criar conta: ' + authError.message);
                }
            }
        } catch (error) {
            console.error("Erro geral no cadastro:", error);
            alert(`❌ Erro no sistema: ${error.message}`);
        } finally {
            setIsRegisteringEmp(false);
        }
    };

    const handleUpdateLog = async () => {
        if (!auditLog || !auditReason) {
            alert('Por favor, insira o motivo da alteração.');
            return;
        }

        try {
            const logRef = doc(db, 'punches', auditLog.id);

            // Criar novo timestamp baseado na hora editada
            const [hours, minutes] = editData.time.split(':');
            const newDate = new Date(editData.date + 'T' + hours + ':' + minutes + ':00');

            await updateDoc(logRef, {
                type: editData.type,
                date: editData.date,
                timestamp: newDate,
                lastEdit: {
                    by: currentUser.uid,
                    at: new Date().toISOString(),
                    reason: auditReason
                }
            });

            alert('Registro atualizado com sucesso! ✅');
            setShowEditModal(false);
            setAuditReason('');
            handleGenerateReport(); // Atualizar tabela
        } catch (error) {
            alert('Erro ao atualizar: ' + error.message);
        }
    };

    const handleDeleteLog = async () => {
        if (!auditLog || !auditReason) {
            alert('Por favor, insira o motivo da exclusão.');
            return;
        }

        try {
            // Salvar backup do registro excluído em uma coleção de auditoria
            await addDoc(collection(db, 'deleted_punches'), {
                ...auditLog,
                deletedBy: currentUser.uid,
                deletedAt: firestoreTimestamp(),
                deleteReason: auditReason
            });

            // Excluir registro original
            await deleteDoc(doc(db, 'punches', auditLog.id));

            alert('Registro excluído com sucesso! 🗑️');
            setShowDeleteModal(false);
            setAuditReason('');
            handleGenerateReport(); // Atualizar tabela
        } catch (error) {
            alert('Erro ao excluir: ' + error.message);
        }
    };

    const handleUpdateStatus = async (e) => {
        e.preventDefault();
        try {
            await updateDoc(doc(db, 'users', selectedEmp.id), {
                status: statusData.type,
                statusStart: statusData.start || null,
                statusEnd: statusData.end || null
            });
            alert('Status do colaborador atualizado! 🔄');
            setShowStatusModal(false);
            // Refresh employee list (USANDO A FUNÇÃO FILTRADA)
            fetchEmployees();
        } catch (error) {
            alert('Erro ao atualizar status: ' + error.message);
        }
    };

    const handleDeleteEmployee = async (emp) => {
        // Opção inicial: Desativar ou Outros
        const choice = window.confirm(`⚠️ O que deseja fazer com "${emp.name}"?\n\n[OK] Apenas DESATIVAR (Mantém histórico e permite reativação fácil).\n\n[CANCELAR] Para opções de EXCLUSÃO definitiva do banco.`);

        if (choice) {
            // Fluxo de Desativação (Soft Delete)
            try {
                await updateDoc(doc(db, 'users', emp.id), {
                    status: 'desativado',
                    updatedAt: firestoreTimestamp()
                });
                alert('✅ Colaborador desativado. Ele não consegue mais logar, mas os registros foram mantidos.');
                fetchEmployees();
            } catch (error) {
                alert(`❌ Erro ao desativar: ${error.message}`);
            }
        } else {
            // Fluxo de Exclusão Definitiva (Hard Delete de Firestore)
            if (window.confirm(`🔥 PERIGO: Deseja EXCLUIR DEFINITIVAMENTE o perfil de "${emp.name}" de nosso banco de dados?\n\nIsso limpará os dados do colaborador. Se ele tiver registros de ponto, estes ficarão sem nome. Esta ação NÃO PODE SER DESFEITA.`)) {
                try {
                    await deleteDoc(doc(db, 'users', emp.id));
                    alert('🗑️ Perfil apagado do banco com sucesso.');
                    fetchEmployees();
                } catch (error) {
                    alert(`❌ Erro ao excluir: ${error.message}`);
                }
            }
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
                                    <h3 className="font-black uppercase tracking-[0.3em] text-xs text-emerald-500">Novo Registro Operador</h3>
                                    <p className="text-[9px] font-mono text-emerald-500/40 uppercase mt-1">SISTEMA IDENTIFICAÇÃO V1.0</p>
                                </div>
                                <button onClick={() => setShowRegisterModal(false)} className="text-white/50 hover:text-emerald-500 font-bold text-2xl transition-colors">&times;</button>
                            </div>

                            <form onSubmit={handleRegister} className="p-8 space-y-6">
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Identificação Nome</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="NOME COMPLETO"
                                            className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase"
                                            value={newEmployee.name}
                                            onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">E-mail (Opcional)</label>
                                        <input
                                            type="email"
                                            placeholder="EMAIL@EXEMPLO.COM"
                                            className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase"
                                            value={newEmployee.email}
                                            onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">CPF do Colaborador (ID Único)</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="000.000.000-00"
                                            className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xl text-white tracking-[0.2em]"
                                            value={newEmployee.cpf}
                                            onChange={e => setNewEmployee({ ...newEmployee, cpf: formatCPF(e.target.value) })}
                                        />
                                        <p className="text-[8px] font-mono text-emerald-500/60 uppercase mt-1">O CPF será usado como login em qualquer empresa.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Matrícula_ID</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="0000"
                                                className="w-full bg-white/5 border border-white/10 p-3 outline-none font-mono text-xs text-emerald-500/50 uppercase cursor-not-allowed"
                                                readOnly
                                                value={newEmployee.matricula}
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
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Permissão Sistema</label>
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
                                    <button
                                        type="button"
                                        onClick={() => setShowRegisterModal(false)}
                                        className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/5 text-white transition-colors"
                                    >
                                        Abortar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isRegisteringEmp}
                                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] ${isRegisteringEmp ? 'bg-emerald-900 text-emerald-500/50 cursor-not-allowed' : 'bg-emerald-500 text-black hover:bg-emerald-400'}`}
                                    >
                                        {isRegisteringEmp ? 'PROCESSANDO...' : 'Confirmar Registro'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {showEditModal && (
                    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
                        <div className="bg-black/80 backdrop-blur-2xl border-2 border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.2)] w-full max-w-md overflow-hidden animate-fade-in relative">
                            <div className="bg-blue-500/10 px-8 py-5 border-b border-white/5 flex justify-between items-center text-white">
                                <div>
                                    <h3 className="font-black uppercase tracking-[0.3em] text-xs text-blue-500">Ajuste_de_Registro</h3>
                                    <p className="text-[9px] font-mono text-blue-500/40 uppercase mt-1">AUDITORIA_MOD_V1.0</p>
                                </div>
                                <button onClick={() => setShowEditModal(false)} className="text-white/50 hover:text-blue-500 font-bold text-2xl transition-colors">&times;</button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-blue-500/50 uppercase tracking-[0.2em] pl-1">Data</label>
                                        <input
                                            type="date"
                                            className="w-full bg-white/5 border border-white/10 p-3 focus:border-blue-500 outline-none font-mono text-xs text-white"
                                            value={editData.date}
                                            onChange={e => setEditData({ ...editData, date: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-blue-500/50 uppercase tracking-[0.2em] pl-1">Horário</label>
                                        <input
                                            type="time"
                                            className="w-full bg-white/5 border border-white/10 p-3 focus:border-blue-500 outline-none font-mono text-xs text-white"
                                            value={editData.time}
                                            onChange={e => setEditData({ ...editData, time: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-blue-500/50 uppercase tracking-[0.2em] pl-1">Tipo de Registro</label>
                                    <select
                                        className="w-full bg-white/5 border border-white/10 p-3 focus:border-blue-500 outline-none font-mono text-xs text-white uppercase"
                                        value={editData.type}
                                        onChange={e => setEditData({ ...editData, type: e.target.value })}
                                    >
                                        <option value="entrada" className="bg-gray-900">ENTRADA</option>
                                        <option value="saida_almoco" className="bg-gray-900">SAÍDA ALMOÇO</option>
                                        <option value="volta_almoco" className="bg-gray-900">VOLTA ALMOÇO</option>
                                        <option value="saida" className="bg-gray-900">SAÍDA FINAL</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-blue-500/50 uppercase tracking-[0.2em] pl-1 text-red-500">Motivo da Alteração *</label>
                                    <textarea
                                        required
                                        className="w-full bg-white/5 border border-white/10 p-3 focus:border-blue-500 outline-none font-mono text-[10px] text-white h-24 uppercase"
                                        placeholder="DESCREVA O MOTIVO DA MUDANÇA (AUDITÁVEL)"
                                        value={auditReason}
                                        onChange={e => setAuditReason(e.target.value)}
                                    ></textarea>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-3 border border-white/10 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all">ABORTAR</button>
                                    <button onClick={handleUpdateLog} className="flex-1 px-4 py-3 bg-blue-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-blue-400 transition-all shadow-lg active:scale-95">SALVAR_ALTERAÇÃO</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Modal */}
                {showDeleteModal && (
                    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
                        <div className="bg-black/80 backdrop-blur-2xl border-2 border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.2)] w-full max-w-md overflow-hidden animate-fade-in relative">
                            <div className="bg-red-500/10 px-8 py-5 border-b border-white/5 flex justify-between items-center text-white">
                                <div>
                                    <h3 className="font-black uppercase tracking-[0.3em] text-xs text-red-500">Exclusão_de_Registro</h3>
                                    <p className="text-[9px] font-mono text-red-500/40 uppercase mt-1">SISTEMA_SEGURANÇA_V1.0</p>
                                </div>
                                <button onClick={() => setShowDeleteModal(false)} className="text-white/50 hover:text-red-500 font-bold text-2xl transition-colors">&times;</button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="bg-red-500/5 border border-red-500/10 p-4">
                                    <p className="text-[10px] text-red-500/70 font-mono uppercase tracking-widest text-center">
                                        Esta ação é irreversível. O registro será removido do banco de dados principal.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-red-500/50 uppercase tracking-[0.2em] pl-1">Motivo da Exclusão *</label>
                                    <textarea
                                        required
                                        className="w-full bg-white/5 border border-white/10 p-3 focus:border-red-500 outline-none font-mono text-[10px] text-white h-24 uppercase"
                                        placeholder="JUSTIFICATIVA OBRIGATÓRIA PARA EXCLUSÃO"
                                        value={auditReason}
                                        onChange={e => setAuditReason(e.target.value)}
                                    ></textarea>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-3 border border-white/10 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all">ABORTAR</button>
                                    <button onClick={handleDeleteLog} className="flex-1 px-4 py-3 bg-red-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg active:scale-95">CONFIRMAR_EXCLUSÃO</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status/Vacation Modal */}
                {showStatusModal && (
                    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
                        <div className="bg-black/60 backdrop-blur-2xl border-2 border-white/10 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in relative">
                            <div className="bg-emerald-500/10 px-8 py-5 border-b border-white/5 flex justify-between items-center text-white">
                                <div>
                                    <h3 className="font-black uppercase tracking-[0.3em] text-xs text-emerald-500">Gestão de Status e Ausência</h3>
                                    <p className="text-[9px] font-mono text-emerald-500/40 uppercase mt-1">{selectedEmp?.name}</p>
                                </div>
                                <button onClick={() => setShowStatusModal(false)} className="text-white/50 hover:text-emerald-500 font-bold text-2xl transition-colors">&times;</button>
                            </div>

                            <form onSubmit={handleUpdateStatus} className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Tipo de Status</label>
                                        <select
                                            className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white uppercase appearance-none"
                                            value={statusData.type}
                                            onChange={e => setStatusData({ ...statusData, type: e.target.value })}
                                        >
                                            <option value="ativo" className="bg-gray-900">ATIVO / EM CAMPO</option>
                                            <option value="ferias" className="bg-gray-900">EM FÉRIAS</option>
                                            <option value="afastado" className="bg-gray-900">AFASTADO (MÉDICO/OUTROS)</option>
                                        </select>
                                    </div>

                                    {statusData.type !== 'ativo' && (
                                        <div className="grid grid-cols-2 gap-4 animate-fade-in">
                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Início</label>
                                                <input
                                                    type="date"
                                                    required
                                                    className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white"
                                                    value={statusData.start}
                                                    onChange={e => setStatusData({ ...statusData, start: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Fim</label>
                                                <input
                                                    type="date"
                                                    required
                                                    className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none font-mono text-xs text-white"
                                                    value={statusData.end}
                                                    onChange={e => setStatusData({ ...statusData, end: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button type="submit" className="w-full bg-emerald-500 text-black py-4 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg active:scale-95">
                                    ATUALIZAR_STATUS_OPERADOR
                                </button>
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
                                <p className="text-[10px] font-mono text-emerald-500 font-black uppercase tracking-[0.2em]">Registro Visual Validado</p>
                            </div>
                        </div>
                    </div>
                )}
                {/* Header */}
                <header className="bg-black/40 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tighter uppercase italic">
                                    🌱 Sistema de <span className="text-emerald-500">Ponto</span>
                                </h1>
                                <p className="text-[8px] sm:text-[10px] font-mono text-gray-400 mt-1 uppercase tracking-widest">
                                    Módulo Administrativo // {currentUser?.name || 'ADMIN'}
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
                        <nav className="flex space-x-8 overflow-x-auto scrollbar-hide no-scrollbar">
                            {[
                                { id: 'overview', label: 'Visão Geral', icon: '📊' },
                                { id: 'employees', label: 'Funcionários', icon: '👥' },
                                { id: 'reports', label: 'Relatórios', icon: '📋' },
                                { id: 'settings', label: 'Configurações', icon: '⚙️' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`py-4 px-1 border-b-2 font-black text-[10px] uppercase tracking-widest transition-all transition-colors whitespace-nowrap min-w-max flex items-center ${activeTab === tab.id
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
                <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
                    {/* Alerta de Setup Pendente */}
                    {!currentCompany && userRole === 'admin' && (
                        <div className="mb-8 bg-amber-500/10 border border-amber-500/30 p-6 rounded-lg flex items-center justify-between animate-pulse">
                            <div>
                                <h3 className="text-amber-500 font-black uppercase text-sm tracking-widest mb-1">⚠️ Organização Não Configurada</h3>
                                <p className="text-[10px] text-gray-400 font-mono uppercase">Você precisa concluir o perfil da empresa para liberar o sistema.</p>
                            </div>
                            <button
                                onClick={() => setShowCompanySetup(true)}
                                className="px-6 py-3 bg-amber-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-amber-400 transition-all shadow-lg"
                            >
                                Configurar Agora
                            </button>
                        </div>
                    )}

                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex justify-between items-end">
                                <h2 className="text-2xl font-black text-white tracking-tight uppercase border-l-4 border-emerald-500 pl-4">
                                    Status da Operação
                                </h2>
                                <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                                    Live Update: {new Date().toLocaleTimeString()}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-4 sm:p-6 rounded-2xl shadow-2xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 sm:mb-2">Funcionários Ativos</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl sm:text-4xl font-black text-white">{employees.length}</span>
                                        <span className="text-[8px] sm:text-[10px] font-bold text-emerald-500">UNIDADES</span>
                                    </div>
                                </div>

                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-4 sm:p-6 rounded-2xl shadow-2xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 sm:mb-2">Presentes Agora</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl sm:text-4xl font-black text-emerald-500">{stats.present}</span>
                                        <span className="text-[8px] sm:text-[10px] font-bold text-emerald-500">EM CAMPO</span>
                                    </div>
                                </div>

                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-4 sm:p-6 rounded-2xl shadow-2xl border-l-orange-500">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 sm:mb-2">Saídas Eventuais</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl sm:text-4xl font-black text-orange-500">{stats.eventuals}</span>
                                        <span className="text-[8px] sm:text-[10px] font-bold text-orange-500">HOJE</span>
                                    </div>
                                </div>

                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-4 sm:p-6 rounded-2xl shadow-2xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 sm:mb-2">Sincronização</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Estável</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                                    <div className="bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-500 px-4 py-2 flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest">Últimas Ocorrências</span>
                                        <span className="text-[10px] font-mono opacity-50">LOG_SYSTEM_V.1.0</span>
                                    </div>
                                    <div className="p-0 divide-y divide-white/5">
                                        {recentLogs.length > 0 ? recentLogs.map((log, idx) => {
                                            const isOutside = log.location && calculateDistance(log.location.latitude, log.location.longitude, geofence.latitude, geofence.longitude) > geofence.radius;
                                            const employeeName = log.userName || 'N/A';
                                            const initials = employeeName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                                            return (
                                                <div key={log.id} className="group px-6 py-4 hover:bg-white/[0.03] flex items-center justify-between transition-all duration-300">
                                                    <div className="flex items-center gap-4">
                                                        {/* Avatar Circle */}
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-[10px] border-2 transition-all group-hover:scale-110 ${isOutside ? 'border-red-500/30 bg-red-500/5 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                                                            }`}>
                                                            {initials}
                                                        </div>

                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-[11px] font-black text-white uppercase tracking-tight leading-none">
                                                                    {employeeName}
                                                                </p>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${isOutside ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">
                                                                    {log.type === 'entrada' ? '🌅 Entrada' :
                                                                        log.type === 'saida_almoco' ? '🍽️ Almoço' :
                                                                            log.type === 'volta_almoco' ? '↩️ Retorno' : '🌙 Saída'}
                                                                </span>
                                                                <span className="text-[9px] text-gray-600 font-mono">•</span>
                                                                <span className="text-[10px] text-emerald-500/80 font-black font-mono">
                                                                    {log.timestamp?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right flex flex-col items-end gap-1">
                                                            <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-sm border ${isOutside
                                                                ? 'text-red-500 bg-red-500/10 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                                                                : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                                                                }`}>
                                                                {isOutside ? 'FORA_PERÍMETRO' : 'OK_AUTORIZADO'}
                                                            </span>
                                                            {isOutside && (
                                                                <p className="text-[8px] font-mono text-gray-600 italic uppercase">
                                                                    Dist: {Math.round(calculateDistance(log.location.latitude, log.location.longitude, geofence.latitude, geofence.longitude))}m
                                                                </p>
                                                            )}
                                                        </div>

                                                        {log.photo && (
                                                            <button
                                                                onClick={() => setPreviewPhoto(log.photo)}
                                                                className="w-8 h-8 rounded-lg border border-white/5 bg-white/5 hover:bg-emerald-500/20 hover:border-emerald-500/30 flex items-center justify-center transition-all group-hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] active:scale-90"
                                                                title="Visualizar Auditoria Facial"
                                                            >
                                                                <span className="text-xs">📸</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="p-16 text-center">
                                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 opacity-20">📡</div>
                                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] font-mono italic">
                                                    Aguardando_Sincronização_Operacional...
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-black/40 backdrop-blur-xl border border-white/5 overflow-hidden p-6 relative shadow-2xl">
                                    <div className="absolute top-0 right-0 p-4">
                                        <div className="w-12 h-12 border-t border-r border-emerald-500/20"></div>
                                    </div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/50 mb-6 italic">Acesso_Rápido // Operações</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <button onClick={() => setActiveTab('reports')} className="group bg-white/5 border border-white/10 p-5 rounded-xl text-left hover:border-emerald-500/50 hover:bg-white/10 transition-all shadow-lg active:scale-95">
                                            <p className="text-2xl mb-2 group-hover:scale-110 transition-transform">📄</p>
                                            <p className="text-xs font-black text-white uppercase leading-none tracking-tight">Exportar Folha</p>
                                            <p className="text-[10px] text-gray-400 mt-2 font-mono uppercase tracking-widest">PDF_Download</p>
                                        </button>
                                        <button onClick={() => setShowRegisterModal(true)} className="group bg-white/5 border border-white/10 p-5 rounded-xl text-left hover:border-emerald-500/50 hover:bg-white/10 transition-all shadow-lg active:scale-95">
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
                                            placeholder="BUSCAR POR NOME, CPF OU MATRÍCULA..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 p-3 pl-10 focus:border-emerald-500 focus:bg-white/10 outline-none font-mono text-[10px] uppercase tracking-widest text-white transition-all shadow-inner"
                                        />
                                        <svg className="w-4 h-4 absolute left-3 top-3.5 text-emerald-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!currentCompany?.id) {
                                                alert("Erro: Empresa não identificada.");
                                                return;
                                            }

                                            try {
                                                // 1. Buscar apenas colaboradores para contar a matrícula sequencial correta
                                                const q = query(
                                                    collection(db, 'users'),
                                                    where('companyId', '==', currentCompany.id),
                                                    where('role', '==', 'employee')
                                                );
                                                const snap = await getDocs(q);

                                                // Próxima matrícula = Total de colaboradores + 1
                                                const nextMatricula = String(snap.docs.length + 1).padStart(4, '0');
                                                console.log("📍 Gerando matrícula:", nextMatricula);

                                                setNewEmployee({
                                                    name: '',
                                                    matricula: nextMatricula,
                                                    cpf: '',
                                                    email: '',
                                                    password: '',
                                                    role: 'employee'
                                                });

                                                // Pequeno delay para garantir que o estado do React atualizou antes do modal abrir
                                                setTimeout(() => setShowRegisterModal(true), 50);

                                            } catch (err) {
                                                console.error("Erro ao preparar cadastro:", err);
                                                alert("Erro ao gerar matrícula automática: " + err.message);
                                            }
                                        }}
                                        className="bg-emerald-500 text-black px-6 py-3 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all active:scale-95 whitespace-nowrap shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                    >
                                        + ADICIONAR
                                    </button>
                                </div>
                            </div>

                            {/* Employee List */}
                            <div className="bg-black/40 backdrop-blur-xl border border-white/5 shadow-2xl overflow-hidden">
                                <div className="overflow-x-auto no-scrollbar">
                                    <table className="w-full text-left font-mono text-[10px] uppercase tracking-wider min-w-[700px]">
                                        <thead>
                                            <tr className="bg-emerald-500/10 text-emerald-500 border-b border-white/5">
                                                <th className="px-6 py-4 font-black">Colaborador</th>
                                                <th className="px-6 py-4 font-black text-center">CPF / Login</th>
                                                <th className="px-6 py-4 font-black text-center">Matrícula ID</th>
                                                <th className="px-6 py-4 font-black">Status</th>
                                                <th className="px-6 py-4 text-right font-black">Ações_Auditoria</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-gray-300">
                                            {filteredEmployees.map((emp) => (
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
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <span className="text-[10px] text-emerald-500/70 font-mono tracking-widest bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10">
                                                            {emp.cpf ? formatCPF(emp.cpf) : 'SEM CPF'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <span className="text-xs text-gray-400 font-mono tracking-widest">{emp.matricula || '0000'}</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            {(!emp.status || emp.status === 'ativo') ? (
                                                                <>
                                                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
                                                                    <span className="text-[9px] font-black text-emerald-500/80 uppercase tracking-widest">Ativo</span>
                                                                </>
                                                            ) : emp.status === 'ferias' ? (
                                                                <>
                                                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_5px_rgba(59,130,246,0.5)]"></div>
                                                                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Em Férias</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full shadow-[0_0_5px_rgba(249,115,22,0.5)]"></div>
                                                                    <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Afastado</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <div className="flex justify-end gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedEmp(emp);
                                                                    setStatusData({
                                                                        type: emp.status || 'ativo',
                                                                        start: emp.statusStart || '',
                                                                        end: emp.statusEnd || ''
                                                                    });
                                                                    setShowStatusModal(true);
                                                                }}
                                                                title="Gerenciar Status/Ausência"
                                                                className="p-2 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 text-emerald-500/70 transition-all font-bold text-xs"
                                                            >
                                                                🏖️
                                                            </button>
                                                            <button
                                                                onClick={() => handleResetPassword(emp)}
                                                                title="Resetar Senha"
                                                                className="p-2 border border-white/10 hover:border-white/30 hover:bg-white/5 text-gray-400 transition-all active:scale-90"
                                                            >
                                                                🔑
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteEmployee(emp)}
                                                                title="Remover Colaborador"
                                                                className="p-2 border border-white/10 hover:border-red-500/50 hover:bg-red-500/5 text-red-500/50 transition-all active:scale-95"
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
                                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Filtrar Colaborador</label>
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
                                        className="bg-emerald-500 text-black py-[14px] w-full md:w-40 px-8 flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] rounded-sm"
                                    >
                                        {isGeneratingReport ? (
                                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                        ) : 'FILTRAR LOGS'}
                                    </button>
                                </div>

                                <div className="border-t border-white/5 pt-10 flex justify-between items-center mb-10">
                                    <div>
                                        <p className="text-[10px] font-black text-emerald-500/30 uppercase tracking-[0.3em]">Resposta Sistema</p>
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
                                            Exportar PDF
                                        </button>
                                        <button
                                            onClick={handleExportCSV}
                                            disabled={reportData.length === 0}
                                            className="px-6 py-2 border border-white/10 text-white text-[9px] font-black uppercase tracking-widest hover:bg-white/5 hover:border-white/30 transition-all disabled:opacity-20"
                                        >
                                            CSV EXCEL
                                        </button>
                                    </div>
                                </div>

                                {reportData.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 animate-fade-in">
                                        <div className="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-2xl shadow-lg">
                                            <p className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mb-1">Total Registros</p>
                                            <p className="text-2xl font-black text-white italic">{reportData.length}</p>
                                        </div>
                                        <div className="bg-orange-500/5 border border-orange-500/10 p-5 rounded-2xl shadow-lg">
                                            <p className="text-[9px] font-black text-orange-500/60 uppercase tracking-widest mb-1">Saídas Eventuais</p>
                                            <p className="text-2xl font-black text-white italic">{reportData.filter(p => p.type === 'saida_eventual').length}</p>
                                        </div>
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl shadow-lg">
                                            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Abonos Realizados</p>
                                            <p className="text-2xl font-black text-white italic">{reportData.filter(p => p.isAbonado).length}</p>
                                        </div>
                                    </div>
                                )}

                                {reportData.length > 0 ? (
                                    <div className="space-y-12">
                                        <div className="bg-emerald-500/5 p-8 border border-emerald-500/10 shadow-inner">
                                            <h3 className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                                Resumo de Horas Líquidas
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

                                        <div className="overflow-x-auto shadow-2xl no-scrollbar">
                                            <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6 italic">Log_Detalhado_Full_Audit</h3>
                                            <table className="w-full text-left font-mono text-[9px] uppercase tracking-widest min-w-[1000px]">
                                                <thead>
                                                    <tr className="bg-emerald-500/10 text-emerald-500 border-b border-white/5">
                                                        <th className="px-5 py-4 font-black">Data</th>
                                                        <th className="px-5 py-4 font-black">Operador</th>
                                                        <th className="px-5 py-4 font-black">Tipo</th>
                                                        <th className="px-5 py-4 font-black">Hora</th>
                                                        <th className="px-5 py-4 font-black">Perímetro</th>
                                                        <th className="px-5 py-4 font-black text-center">Mídia</th>
                                                        <th className="px-5 py-4 font-black">Justificativa</th>
                                                        <th className="px-5 py-4 text-right font-black">Ações</th>
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
                                                            <td className="px-5 py-4">
                                                                <div className="flex justify-center gap-2">
                                                                    {log.photo && (
                                                                        <button
                                                                            onClick={() => setPreviewPhoto(log.photo)}
                                                                            className="w-8 h-8 border border-white/10 hover:border-emerald-500/50 flex items-center justify-center transition-all group-hover:scale-110"
                                                                            title="Ver Foto"
                                                                        >
                                                                            🖼️
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <div className="max-w-[150px] truncate text-[9px] text-gray-500 italic uppercase" title={log.justification}>
                                                                    {log.justification || '---'}
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4 text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    {log.type === 'saida_eventual' && (
                                                                        <button
                                                                            onClick={() => handleAbonoToggle(log)}
                                                                            className={`px-3 py-1 rounded-sm text-[8px] font-black uppercase tracking-widest transition-all ${log.isAbonado ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-emerald-500/10 hover:text-emerald-500'}`}
                                                                        >
                                                                            {log.isAbonado ? '✓ Abonado' : 'Abonar?'}
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => {
                                                                            setAuditLog(log);
                                                                            const ts = log.timestamp?.toDate() || new Date();
                                                                            setEditData({
                                                                                type: log.type,
                                                                                time: ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                                                                                date: log.date
                                                                            });
                                                                            setShowEditModal(true);
                                                                        }}
                                                                        className="w-8 h-8 border border-white/10 hover:border-blue-500/50 flex items-center justify-center transition-all hover:bg-blue-500/10"
                                                                        title="Editar Registro"
                                                                    >
                                                                        ✏️
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setAuditLog(log);
                                                                            setShowDeleteModal(true);
                                                                        }}
                                                                        className="w-8 h-8 border border-white/10 hover:border-red-500/50 flex items-center justify-center transition-all hover:bg-red-500/10"
                                                                        title="Excluir Registro"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </div>
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
                                            {isGeneratingReport ? 'Synchronizing Cloud Data...' : 'Aguardando Critérios de Busca'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'settings' && (
                        <div className="space-y-6 animate-fade-in px-0 sm:px-0">
                            <div className="flex justify-between items-end mb-4">
                                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase border-l-4 border-emerald-500 pl-4">
                                    Configurações do Sistema
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
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

                                <div className="space-y-8">
                                    <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-8 shadow-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-bl-full -mr-10 -mt-10 transition-all group-hover:bg-emerald-500/10"></div>

                                        <h3 className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2 relative z-10">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                            Perfil da Organização
                                        </h3>

                                        <form onSubmit={handleSaveCompany} className="space-y-6 relative z-10">

                                            <div className="bg-emerald-500/5 p-4 border border-emerald-500/20 rounded-sm mb-6">
                                                <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Código Corporativo</label>
                                                <div className="text-2xl font-mono text-white font-black tracking-widest select-all">
                                                    {currentCompany?.loginCode || "PENDENTE"}
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1">Nome Fantasia</label>
                                                    <input
                                                        type="text"
                                                        value={companyForm.name}
                                                        onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                                                        className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none text-white font-mono text-xs uppercase"
                                                        placeholder="MINHA EMPRESA"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1">CNPJ</label>
                                                        <input
                                                            type="text"
                                                            maxLength={18}
                                                            value={companyForm.cnpj || ''}
                                                            onChange={(e) => setCompanyForm({ ...companyForm, cnpj: formatCNPJ(e.target.value) })}
                                                            className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none text-white font-mono text-xs uppercase"
                                                            placeholder="00.000.000/0001-00"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1">Telefone</label>
                                                        <input
                                                            type="text"
                                                            value={companyForm.phone || ''}
                                                            onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                                                            className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none text-white font-mono text-xs uppercase"
                                                            placeholder="(00) 00000-0000"
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1">Escala</label>
                                                    <select
                                                        value={companyForm.workSchedule || 'monday_friday'}
                                                        onChange={(e) => setCompanyForm({ ...companyForm, workSchedule: e.target.value })}
                                                        className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none text-white font-mono text-xs uppercase appearance-none cursor-pointer"
                                                    >
                                                        <option value="monday_friday" className="bg-gray-900">Segunda a Sexta</option>
                                                        <option value="monday_saturday" className="bg-gray-900">Segunda a Sábado</option>
                                                        <option value="monday_sunday" className="bg-gray-900">Todos os Dias</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1">Endereço</label>
                                                    <input
                                                        type="text"
                                                        value={companyForm.address || ''}
                                                        onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                                                        className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none text-white font-mono text-xs uppercase"
                                                        placeholder="ENDEREÇO COMPLETO"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1">Jornada (h)</label>
                                                        <input
                                                            type="number"
                                                            value={companyForm.workHours}
                                                            onChange={(e) => setCompanyForm({ ...companyForm, workHours: e.target.value })}
                                                            className="w-full bg-white/5 border border-white/10 p-3 focus:border-emerald-500 outline-none text-white font-mono text-xs uppercase"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1">Status</label>
                                                        <div className="w-full bg-white/5 border border-white/10 p-3 text-emerald-500 font-mono text-xs uppercase flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                                            ATIVO
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                className="w-full py-4 bg-emerald-600 text-black font-black text-[10px] uppercase tracking-[0.3em] hover:bg-emerald-500 transition-all shadow-lg"
                                            >
                                                Salvar Perfil
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {/* MODAL DE CONFIGURAÇÃO INICIAL DA EMPRESA (BLOQUEANTE) */}
                {showCompanySetup && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-fade-in">
                        <div className="bg-gray-900 border border-emerald-500/30 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(16,185,129,0.1)] rounded-sm relative">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-pulse"></div>
                            <div className="bg-emerald-500/10 border-b border-emerald-500/20 p-8 text-center">
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-3 mb-2">
                                    <span className="text-emerald-500 animate-bounce">⚡</span> Configuração _Inicial
                                </h2>
                                <p className="text-[10px] text-emerald-500/60 font-mono uppercase tracking-[0.2em]">
                                    Identificação da Organização Obrigatória
                                </p>
                            </div>

                            <form onSubmit={handleSaveCompany} className="p-8 space-y-8">
                                <div className="bg-emerald-500/5 p-6 border border-emerald-500/20 rounded-sm">
                                    <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2 text-center">Seu Código de Acesso Corporativo</label>
                                    <div className="text-4xl font-mono text-white font-black tracking-widest text-center select-all">
                                        {currentCompany?.loginCode || "GERADO APÓS SALVAR"}
                                    </div>
                                    <p className="text-[9px] text-gray-500 mt-3 text-center uppercase tracking-widest">Este código vinculará todos os seus colaboradores</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1">Nome Fantasia</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-white/5 border border-white/10 p-4 focus:border-emerald-500 outline-none text-white font-mono text-sm uppercase transition-all"
                                            placeholder="MINHA ORGANIZAÇÃO LTDA"
                                            value={companyForm.name}
                                            onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1">CNPJ</label>
                                        <input
                                            type="text"
                                            maxLength={18}
                                            value={companyForm.cnpj || ""}
                                            onChange={(e) => setCompanyForm({ ...companyForm, cnpj: formatCNPJ(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 p-4 focus:border-emerald-500 outline-none text-white font-mono text-sm uppercase transition-all"
                                            placeholder="00.000.000/0001-00"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSavingSettings}
                                    className="w-full py-5 bg-emerald-600 text-black font-black text-xs uppercase tracking-[0.3em] hover:bg-emerald-500 transition-all shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:shadow-[0_0_50px_rgba(16,185,129,0.6)] relative overflow-hidden group"
                                >
                                    {isSavingSettings ? "CONFIGURANDO..." : "FINALIZAR CONFIGURAÇÃO"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL RESET SENHA MANUAL */}
                {showPassResetModal && selectedEmp && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-fade-in">
                        <div className="bg-gray-900 border border-emerald-500/30 w-full max-w-md shadow-2xl rounded-sm relative overflow-hidden">
                            <div className="bg-emerald-500/10 border-b border-emerald-500/20 p-6 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Redefinir Senha Manual</h3>
                                    <p className="text-[9px] text-emerald-500/60 font-mono uppercase mt-1">Colaborador: {selectedEmp.name}</p>
                                </div>
                                <button
                                    onClick={() => setShowPassResetModal(false)}
                                    className="text-white/50 hover:text-white transition-colors p-2 text-2xl leading-none"
                                >
                                    &times;
                                </button>
                            </div>

                            <form onSubmit={confirmManualPasswordReset} className="p-8 space-y-6">
                                <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 mb-4">
                                    <p className="text-[9px] text-yellow-500 uppercase font-black tracking-widest leading-relaxed">
                                        ⚠️ AVISO: Esta senha será salva como uma "chave de emergência". O colaborador poderá entrar usando esta nova senha imediatamente.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Nova Senha</label>
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            className="w-full bg-white/5 border border-white/10 p-4 focus:border-emerald-500 outline-none text-white font-mono text-sm"
                                            placeholder="******"
                                            value={newPassForm.password}
                                            onChange={e => setNewPassForm({ ...newPassForm, password: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Confirmar Senha</label>
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            className="w-full bg-white/5 border border-white/10 p-4 focus:border-emerald-500 outline-none text-white font-mono text-sm"
                                            placeholder="******"
                                            value={newPassForm.confirm}
                                            onChange={e => setNewPassForm({ ...newPassForm, confirm: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowPassResetModal(false)}
                                        className="flex-1 py-3 border border-white/10 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isResettingPass}
                                        className="flex-1 py-3 bg-emerald-600 text-black font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20"
                                    >
                                        {isResettingPass ? 'SALVANDO...' : 'Confirmar Alteração'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
