import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import InstallButton from '../components/InstallButton';

const Login = () => {
    const [matricula, setMatricula] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    // TEMPORARY: Function to create test user
    const handleCreateTestUser = async () => {
        try {
            setLoading(true);
            const testMatricula = '1001';
            const testPass = '123456';
            const testEmail = `${testMatricula}@estufa.sistema`;

            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPass);

            // 2. Create Firestore Profile
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                name: 'Usuário Teste',
                role: 'admin',
                matricula: testMatricula,
                createdAt: new Date()
            });

            alert(`Usuário criado!\nMatrícula: ${testMatricula}\nSenha: ${testPass}`);
            setMatricula(testMatricula);
            setPassword(testPass);
        } catch (err) {
            console.error(err);
            alert('Erro ao criar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Transformar matrícula em email para o Firebase
        // Ex: 1050 -> 1050@estufa.sistema
        const emailFormatado = `${matricula}@estufa.sistema`;

        try {
            const userCredential = await login(emailFormatado, password);

            // [MVP FIX] Garantir que o 1001 seja admin no banco para testes
            // Isso evita tela branca ou redirecionamento incorreto se o doc do 1001 não existir ou estiver errado.
            const userDocRef = doc(db, 'users', userCredential.user.uid);
            const userDoc = await getDoc(userDocRef);

            let role = 'employee';
            if (matricula === '1001') {
                role = 'admin';
                // Atualizar no banco se não estiver como admin
                if (!userDoc.exists() || userDoc.data().role !== 'admin') {
                    await setDoc(userDocRef, {
                        name: 'Admin Sistema',
                        matricula: '1001',
                        role: 'admin',
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                }
            } else if (userDoc.exists()) {
                role = userDoc.data().role;
            }

            if (role === 'admin') {
                navigate('/admin');
            } else {
                navigate('/employee');
            }

        } catch (err) {
            console.error('Erro no login:', err);
            setError('Matrícula ou senha incorretos.');
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
            <div className="bg-black/40 backdrop-blur-xl w-full max-w-md border-2 border-white/5 relative z-10 p-8 shadow-2xl">
                {/* Header Context */}
                <div className="mb-10 text-center">
                    <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
                        Acesso_Sistema_v1.0
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">
                        Operação <span className="text-emerald-500">Mudas</span>
                    </h1>
                    <p className="text-gray-500 text-xs font-mono mt-3 tracking-widest uppercase">
                        Identificação Obrigatória
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border-l-4 border-red-500 p-4 mb-6 animate-shake">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-xs font-bold text-red-500 uppercase tracking-widest">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 pl-1">ID_Matrícula</label>
                            <input
                                type="text"
                                required
                                value={matricula}
                                onChange={(e) => setMatricula(e.target.value)}
                                className="w-full bg-white/5 border-2 border-white/10 p-4 focus:border-emerald-500 focus:bg-white/10 outline-none text-white font-mono text-sm tracking-widest transition-all placeholder:text-gray-700"
                                placeholder="DIGITE SUA MATRÍCULA"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 pl-1">Código_Acesso</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white/5 border-2 border-white/10 p-4 focus:border-emerald-500 focus:bg-white/10 outline-none text-white font-mono text-sm tracking-widest transition-all placeholder:text-gray-700"
                                placeholder="******"
                            />
                        </div>
                    </div>

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
                            <span className="ml-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-300 transition-colors">Manter Conexão</span>
                        </label>
                        <button type="button" className="text-[10px] font-bold text-emerald-500/50 uppercase tracking-widest hover:text-emerald-500 transition-colors">Esqueci Senha</button>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 text-[11px] font-black uppercase tracking-[0.3em] transition-all relative overflow-hidden group ${loading ? 'bg-emerald-900/50 text-emerald-500/50' : 'bg-emerald-600 text-black hover:bg-emerald-500 hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                    >
                        {loading ? 'PROCESSANDO...' : 'INICIAR SESSÃO'}
                        {!loading && <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>}
                    </button>
                </form>

                {/* Footer Actions / Dev Tools */}
                <div className="mt-8 pt-8 border-t border-white/5 flex flex-col gap-4">
                    <div className="flex justify-center mb-2">
                        <InstallButton />
                    </div>
                    <button
                        onClick={handleCreateTestUser}
                        disabled={loading}
                        className="text-[9px] font-black text-gray-600 uppercase tracking-widest hover:text-emerald-500 text-center transition-colors border border-white/5 py-2 hover:border-emerald-500/30"
                    >
                        Sistema: Gerar Credenciais de Teste (1001)
                    </button>
                    <p className="text-[8px] text-gray-700 font-mono text-center uppercase tracking-tighter">
                        © 2026 Operação Mudas • Protocolo de Segurança Ativo
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
