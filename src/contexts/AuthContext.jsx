import { createContext, useContext, useState, useEffect } from 'react';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

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

    const login = async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return userCredential;
        } catch (error) {
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            throw error;
        }
    };

    const value = {
        currentUser,
        userRole,
        currentCompany,
        setCurrentCompany, // Expor setter para atualizar após criação
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
