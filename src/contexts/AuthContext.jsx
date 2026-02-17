import { createContext, useContext, useState, useEffect } from 'react';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { getThemeById } from '../config/themes';

// Helper to convert hex to RGB for Tailwind opacity support
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ?
        `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` :
        '16 185 129'; // Default emerald
};

const applyThemeColors = (themeId, customColors = null) => {
    console.log('🎨 [applyThemeColors] Iniciando aplicação do tema:', themeId);

    const theme = getThemeById(themeId);

    if (!theme) {
        console.error('❌ Tema não encontrado:', themeId);
        return;
    }

    // Se for tema custom e tiver cores customizadas, usar elas
    const colors = (themeId === 'custom' && customColors) ? customColors : theme.colors;

    console.log('📦 Theme Object:', theme);
    console.log('🎨 Colors being applied:', colors);

    const root = document.documentElement;

    const color50 = hexToRgb(colors[50]);
    const color500 = hexToRgb(colors[500]);
    const color600 = hexToRgb(colors[600]);
    const color700 = hexToRgb(colors[700]);

    console.log('🔧 Setting CSS Variables:', {
        '--color-primary-50': color50,
        '--color-primary-500': color500,
        '--color-primary-600': color600,
        '--color-primary-700': color700
    });

    root.style.setProperty('--color-primary-50', color50);
    root.style.setProperty('--color-primary-500', color500);
    root.style.setProperty('--color-primary-600', color600);
    root.style.setProperty('--color-primary-700', color700);

    // Verificar se foi aplicado
    console.log('🔍 Verificando aplicação:', {
        '--color-primary-50': root.style.getPropertyValue('--color-primary-50'),
        '--color-primary-500': root.style.getPropertyValue('--color-primary-500'),
        '--color-primary-600': root.style.getPropertyValue('--color-primary-600'),
        '--color-primary-700': root.style.getPropertyValue('--color-primary-700')
    });

    console.log('✅ Theme applied successfully!');
};

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [currentCompany, setCurrentCompany] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                if (user) {
                    // Buscar dados do usuário no Firestore
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    let fullUser = null;

                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        fullUser = { ...user, ...userData };
                        setCurrentUser(fullUser);
                        setUserRole(userData.role);

                        // Se o usuário tem uma empresa vinculada, buscar dados da empresa
                        if (userData.companyId) {
                            try {
                                const companyDoc = await getDoc(doc(db, 'companies', userData.companyId));
                                if (companyDoc.exists()) {
                                    setCurrentCompany({ id: companyDoc.id, ...companyDoc.data() });
                                }
                            } catch (error) {
                                console.error("Erro ao buscar empresa:", error);
                            }
                        }
                    } else {
                        // Fallback para novos usuários (Google Auth, etc)
                        setCurrentUser(user);
                        setUserRole('employee');
                    }
                } else {
                    setCurrentUser(null);
                    setUserRole(null);
                    setCurrentCompany(null);
                }
            } catch (err) {
                console.error("Auth State Change Error:", err);
                setCurrentUser(null);
            } finally {
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        console.log('🎨 Theme Update Triggered:', currentCompany?.themeId || 'emerald');
        if (currentCompany?.themeId) {
            console.log('Applying theme:', currentCompany.themeId);

            // Se for tema custom, passar as cores customizadas
            if (currentCompany.themeId === 'custom' && currentCompany.customTheme) {
                console.log('🎨 Aplicando tema customizado:', currentCompany.customTheme);
                applyThemeColors(currentCompany.themeId, currentCompany.customTheme);
            } else {
                applyThemeColors(currentCompany.themeId);
            }
        } else {
            console.log('Applying default theme: emerald');
            applyThemeColors('emerald');
        }
    }, [currentCompany]);

    const login = async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return userCredential;
        } catch (error) {
            throw error;
        }
    };

    // Função de bypass para quando o Admin altera a senha via Firestore (passwordOverride)
    const setManualUser = async (userData) => {
        setLoading(true);
        setCurrentUser(userData);
        setUserRole(userData.role);

        if (userData.companyId) {
            try {
                const companyDoc = await getDoc(doc(db, 'companies', userData.companyId));
                if (companyDoc.exists()) {
                    setCurrentCompany({ id: companyDoc.id, ...companyDoc.data() });
                }
            } catch (error) {
                console.error("Erro ao buscar empresa manual:", error);
            }
        }
        setLoading(false);
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setCurrentUser(null);
            setUserRole(null);
            setCurrentCompany(null);
        } catch (error) {
            throw error;
        }
    };

    const value = {
        currentUser,
        userRole,
        currentCompany,
        setCurrentCompany,
        setManualUser,
        login,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
