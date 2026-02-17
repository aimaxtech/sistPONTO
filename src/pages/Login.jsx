import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc, getDoc, serverTimestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import InstallButton from '../components/InstallButton';

const Login = () => {
    const [isRegistering, setIsRegistering] = useState(false);

    // Login States
    const [matricula, setMatricula] = useState('');
    const [companyCode, setCompanyCode] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Register States
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [activationKey, setActivationKey] = useState(''); // Chave de segurança para criar conta

    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, setManualUser } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isRegistering) {
                // VERIFICAÇÃO DE SEGURANÇA SAAS
                // Apenas quem tem a chave pode criar conta.
                const SECRET_KEY = "SISPONTO-OFFICIAL-SETUP";

                if (activationKey !== SECRET_KEY) {
                    throw new Error("Chave de Ativação Inválida. Contate o suporte para adquirir uma licença.");
                }

                // FLUXO DE CADASTRO SAAS
                const userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
                const user = userCredential.user;

                // Criar perfil de Admin
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    name: regName,
                    email: regEmail,
                    role: 'admin', // Quem cria conta é Admin
                    createdAt: serverTimestamp(),
                    status: 'ativo'
                });

                // Redirecionar para Admin Dashboard (Setup)
                navigate('/admin');

            } else {
                // FLUXO DE LOGIN (Ajustado para CPF ou e-mail)
                let emailFinal = matricula;

                // Verificar se é um CPF (11 dígitos ou formato de CPF)
                const isCPF = matricula.replace(/\D/g, '').length === 11 && !matricula.includes('@');

                if (isCPF) {
                    const cpfClean = matricula.replace(/\D/g, '');
                    emailFinal = `${cpfClean}@sisponto.com`;
                } else if (!matricula.includes('@')) {
                    // Legado: suporte para matricula antiga com código de empresa
                    if (!companyCode && matricula !== '1001') {
                        throw new Error("Código da Empresa é obrigatório para matrículas legadas.");
                    }

                    if (matricula === '1001') {
                        emailFinal = `1001@estufa.sistema`;
                    } else {
                        emailFinal = `${companyCode}.${matricula}@empresa.ponto`;
                    }
                }

                const userCredential = await login(emailFinal, password);

                // Verificar role
                const userDocRef = doc(db, 'users', userCredential.user.uid);
                const userDoc = await getDoc(userDocRef);

                let role = 'employee';
                if (userDoc.exists()) {
                    role = userDoc.data().role;
                }

                if (role === 'admin') {
                    navigate('/admin');
                } else {
                    navigate('/employee');
                }
            }
        } catch (err) {
            console.error('Erro Auth:', err);

            // TENTATIVA DE LOGIN COM SENHA MANUAL (OVERRIDE) - ESSENCIAL PARA ADMIN ALTERAR SENHA DE FUNC
            if (!isRegistering) {
                try {
                    setLoading(true);
                    let emailInterno = matricula;
                    const isCPF = matricula.replace(/\D/g, '').length === 11 && !matricula.includes('@');

                    if (isCPF) {
                        emailInterno = `${matricula.replace(/\D/g, '')}@sisponto.com`;
                    } else if (!matricula.includes('@')) {
                        emailInterno = matricula === '1001' ? `1001@estufa.sistema` : `${companyCode}.${matricula}@empresa.ponto`;
                    }

                    const q = query(collection(db, 'users'), where('email', '==', emailInterno));
                    const snap = await getDocs(q);

                    if (!snap.empty) {
                        const userDoc = snap.docs[0];
                        const userData = userDoc.data();

                        // Se a senha digitada for igual ao override, "forçamos" a entrada com os dados do Firestore
                        if (userData.passwordOverride === password) {
                            console.log("✅ Login via Override autorizado!");

                            // Estabilizar sessão manual para que os dashboards funcionem
                            await setManualUser({ id: userDoc.id, ...userData });

                            // Em um PWA sem backend de Admin, usamos o estado do Firestore como verdade
                            if (userData.role === 'admin') {
                                navigate('/admin');
                            } else {
                                navigate('/employee');
                            }
                            return; // Interrompe o fluxo de erro
                        }
                    }
                } catch (e) {
                    console.error("Erro busca override:", e);
                }
            }

            if (isRegistering) {
                setError('Erro ao criar conta: ' + (err.code === 'auth/email-already-in-use' ? 'Email já cadastrado.' : err.message));
            } else {
                setError('Credenciais incorretas ou usuário não encontrado.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 font-sans text-gray-100 selection:bg-emerald-500/30">
            {/* Background Decoration */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/20 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/10 blur-[120px] rounded-full"></div>
            </div>

            {/* Main Container */}
            <div className="bg-black/40 backdrop-blur-xl w-full max-w-md border-2 border-white/5 relative z-10 p-8 shadow-2xl transition-all">
                {/* Header Context */}
                <div className="mb-8 text-center">
                    <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
                        {isRegistering ? 'Nova_Organização' : 'Acesso_Sistema_v2.0'}
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">
                        Sistema de <span className="text-emerald-500">Ponto</span>
                    </h1>
                    <p className="text-gray-400 text-xs font-mono mt-3 tracking-widest uppercase">
                        {isRegistering ? 'Crie sua conta administrativa' : 'Identificação Obrigatória'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border-l-4 border-red-500 p-4 mb-6 animate-shake">
                        <p className="text-xs font-bold text-red-500 uppercase tracking-widest">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* TOGGLE TABS */}
                    <div className="flex bg-white/5 p-1 rounded-lg mb-6">
                        <button
                            type="button"
                            onClick={() => { setIsRegistering(false); setError(''); }}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-md ${!isRegistering ? 'bg-emerald-500 text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                        >
                            Entrar
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsRegistering(true); setError(''); }}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-md ${isRegistering ? 'bg-emerald-500 text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                        >
                            Criar Conta
                        </button>
                    </div>

                    <div className="space-y-4">
                        {isRegistering ? (
                            <>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1">Nome do Responsável</label>
                                    <input
                                        type="text"
                                        required
                                        value={regName}
                                        onChange={(e) => setRegName(e.target.value)}
                                        className="w-full bg-white/5 border-2 border-white/10 p-4 focus:border-emerald-500 focus:bg-white/10 outline-none text-white font-mono text-sm tracking-widest transition-all placeholder:text-gray-700"
                                        placeholder="SEU NOME COMPLETO"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1">Email Corporativo</label>
                                    <input
                                        type="email"
                                        required
                                        value={regEmail}
                                        onChange={(e) => setRegEmail(e.target.value)}
                                        className="w-full bg-white/5 border-2 border-white/10 p-4 focus:border-emerald-500 focus:bg-white/10 outline-none text-white font-mono text-sm tracking-widest transition-all placeholder:text-gray-700"
                                        placeholder="ADMIN@EMPRESA.COM"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1">Senha de Acesso</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={regPassword}
                                        onChange={(e) => setRegPassword(e.target.value)}
                                        className="w-full bg-white/5 border-2 border-white/10 p-4 focus:border-emerald-500 focus:bg-white/10 outline-none text-white font-mono text-sm tracking-widest transition-all placeholder:text-gray-700"
                                        placeholder="******"
                                    />
                                </div>
                                <div className="bg-emerald-500/10 p-4 border border-emerald-500/30 rounded-lg">
                                    <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2 pl-1">Chave de Licença / Voucher</label>
                                    <input
                                        type="text"
                                        required
                                        value={activationKey}
                                        onChange={(e) => setActivationKey(e.target.value)}
                                        className="w-full bg-black/50 border-2 border-emerald-500/50 p-4 focus:border-emerald-500 outline-none text-white font-mono text-sm tracking-widest transition-all placeholder:text-gray-600"
                                        placeholder="INSIRA SUA CHAVE DE ATIVAÇÃO"
                                    />
                                    <p className="text-[8px] text-gray-400 mt-2 uppercase tracking-tight">
                                        *Necessário adquirir licença para criar nova organização.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label htmlFor="login-id" className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1 cursor-pointer hover:text-emerald-500 transition-colors">
                                        {matricula.replace(/\D/g, '').length === 11 ? 'CPF Identificado' : 'E-mail ou CPF'}
                                    </label>
                                    <input
                                        id="login-id"
                                        type="text"
                                        required
                                        value={matricula}
                                        onChange={(e) => setMatricula(e.target.value)}
                                        className={`w-full bg-white/10 border-2 p-4 focus:border-emerald-500 focus:bg-white/20 outline-none text-white font-mono text-sm tracking-widest transition-all placeholder:text-gray-600 ${matricula.replace(/\D/g, '').length === 11 ? 'border-emerald-500/50' : 'border-white/10'}`}
                                        placeholder="000.000.000-00"
                                    />
                                </div>
                                {matricula.replace(/\D/g, '').length !== 11 && !matricula.includes('@') && matricula !== '1001' && (
                                    <div className="animate-fade-in">
                                        <label htmlFor="company-code" className="block text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2 pl-1 cursor-pointer">Código da Empresa</label>
                                        <input
                                            id="company-code"
                                            type="text"
                                            required
                                            value={companyCode}
                                            onChange={(e) => setCompanyCode(e.target.value)}
                                            className="w-full bg-emerald-500/10 border-2 border-emerald-500/30 p-4 focus:border-emerald-500 focus:bg-emerald-500/20 outline-none text-white font-mono text-sm tracking-widest transition-all placeholder:text-emerald-900/50"
                                            placeholder="CÓDIGO CORPORATIVO"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="password" className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1 cursor-pointer hover:text-emerald-500 transition-colors">Senha de Acesso</label>
                                    <div className="relative group/pass">
                                        <input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className={`w-full bg-white/10 border-2 p-4 outline-none text-white font-mono text-sm tracking-widest transition-all placeholder:text-gray-600 pr-12 ${password.length >= 6 ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-white/10'
                                                } focus:border-emerald-500 focus:bg-white/20`}
                                            placeholder="******"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-emerald-500 transition-colors p-1"
                                            title={showPassword ? "Esconder" : "Mostrar"}
                                        >
                                            {showPassword ? (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            )}
                                        </button>
                                        {password.length > 0 && password.length < 6 && (
                                            <p className="text-[7px] text-amber-500 mt-1 uppercase font-black tracking-widest animate-pulse">Min. 6 caracteres</p>
                                        )}
                                        {password.length >= 6 && (
                                            <div className="absolute right-12 top-1/2 -translate-y-1/2 text-emerald-500 animate-fade-in">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {!isRegistering && (
                        <div className="flex items-center justify-between">
                            <label className="flex items-center group cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="hidden"
                                />
                                <div className={`w-4 h-4 border-2 flex items-center justify-center transition-all ${rememberMe ? 'bg-emerald-500 border-emerald-500' : 'border-white/10'}`}>
                                    {rememberMe && <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>}
                                </div>
                                <span className="ml-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-300 transition-colors">Manter Conexão</span>
                            </label>
                            <button type="button" className="text-[10px] font-bold text-emerald-500/50 uppercase tracking-widest hover:text-emerald-500 transition-colors">Esqueci Senha</button>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 text-[11px] font-black uppercase tracking-[0.3em] transition-all relative overflow-hidden group ${loading ? 'bg-emerald-900/50 text-emerald-500/50' : 'bg-emerald-600 text-black hover:bg-emerald-500 hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                    >
                        {loading ? 'PROCESSANDO...' : (isRegistering ? 'CRIAR CONTA SAAS' : 'INICIAR SESSÃO')}
                        {!loading && <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>}
                    </button>
                </form>

                {/* Footer Actions / Dev Tools */}
                <div className="mt-8 pt-8 border-t border-white/5 flex flex-col gap-4">
                    <div className="flex justify-center mb-2">
                        <InstallButton />
                    </div>
                    <p className="text-[8px] text-gray-700 font-mono text-center uppercase tracking-tighter">
                        © 2026 Sistema de Ponto • Protocolo de Segurança Ativo
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
