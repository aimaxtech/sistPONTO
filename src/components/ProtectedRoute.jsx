import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
    const { currentUser, userRole, loading } = useAuth(); // Assuming loading is available in AuthContext

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
        );
    }


    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && userRole !== requiredRole) {
        // Prevent infinite loops: if we want to go where we already are, don't redirect (or show unauthorized)
        const targetPath = userRole === 'admin' ? '/admin' : '/employee';

        // If the user's role dictates they should be here, but the props say otherwise, it's a conflict. 
        // But usually we trust the role.
        // Simple check: don't redirect if we are already targeting the right place? No, we are in a route with 'requiredRole'.

        // If I am 'employee' and try to access '/admin' (requiredRole='admin'), I get sent to '/employee'.
        // If I am 'employee' and try to access '/employee' (requiredRole='employee'), I stay (condition fails).

        // The edge case is if I have NO role or an unknown role.
        if (!userRole) {
            return <div className="p-10 text-center">Erro: Usuário sem perfil de acesso. Contate o suporte.</div>;
        }

        return <Navigate to={targetPath} replace />;
    }

    return children;
};

export default ProtectedRoute;
