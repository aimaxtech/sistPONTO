import { useState, useRef, useEffect } from 'react';
import { PUNCH_TYPES, PUNCH_LABELS } from '../config/firebase';
import { db, auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const PunchButton = ({ onPunchSuccess }) => {
    const { currentUser, currentCompany } = useAuth();
    const [selectedType, setSelectedType] = useState(PUNCH_TYPES.ENTRADA);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [currentLocation, setCurrentLocation] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [cameraStream, setCameraStream] = useState(null);
    const [justification, setJustification] = useState('');
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        const syncPendingPunches = async () => {
            if (!navigator.onLine || isSyncing) return;
            const pending = JSON.parse(localStorage.getItem('pending_punches') || '[]');
            if (pending.length === 0) { setPendingCount(0); return; }
            setIsSyncing(true);
            const remaining = [];
            for (const punch of pending) {
                try {
                    await addDoc(collection(db, 'punches'), { ...punch, timestamp: serverTimestamp(), isOffline: true });
                } catch (error) { console.error(error); remaining.push(punch); }
            }
            localStorage.setItem('pending_punches', JSON.stringify(remaining));
            setPendingCount(remaining.length); setIsSyncing(false);
        };
        syncPendingPunches();
        window.addEventListener('online', syncPendingPunches);
        return () => window.removeEventListener('online', syncPendingPunches);
    }, [isSyncing]);

    const requestPermissions = async () => {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
            });
            return { location: { latitude: position.coords.latitude, longitude: position.coords.longitude } };
        } catch (error) { throw new Error('Ative o GPS para registrar o ponto.'); }
    };

    const startCamera = async () => {
        try {
            setShowCamera(true);
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            setCameraStream(stream);
        } catch (error) {
            try {
                const fallback = await navigator.mediaDevices.getUserMedia({ video: true });
                setCameraStream(fallback);
            } catch (e) { setShowCamera(false); throw new Error('Câmera bloqueada.'); }
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0);
            setCapturedPhoto(canvasRef.current.toDataURL('image/jpeg', 0.8));
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            setShowCamera(false);
        }
    };

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const handlePunch = async () => {
        setIsProcessing(true);
        try {
            const { location } = await requestPermissions();
            setCurrentLocation(location);
            if (currentCompany?.latitude && currentCompany?.longitude) {
                const dist = calculateDistance(location.latitude, location.longitude, currentCompany.latitude, currentCompany.longitude);
                if (dist > (currentCompany.radius || 100)) {
                    if (!window.confirm(`Você está fora da área (${Math.round(dist)}m). Registrar como externo?`)) {
                        setIsProcessing(false); return;
                    }
                }
            }
            await startCamera();
        } catch (error) { alert(error.message); setIsProcessing(false); }
    };

    const confirmPunch = async () => {
        try {
            const now = new Date();
            const punchData = {
                userId: auth.currentUser.uid,
                userName: currentUser?.name || 'Funcionário',
                companyId: currentCompany?.id || '',
                type: selectedType,
                location: currentLocation,
                photo: capturedPhoto,
                justification: justification || '',
                date: now.toISOString().split('T')[0],
                offlineTimestamp: now.toISOString()
            };
            if (navigator.onLine) {
                await addDoc(collection(db, 'punches'), { ...punchData, timestamp: serverTimestamp() });
                // Também salva na coleção de backup 'logs' para o Admin ver
                await addDoc(collection(db, 'logs'), { ...punchData, timestamp: serverTimestamp() });
                alert('Ponto registrado! ✅');
            } else {
                const pending = JSON.parse(localStorage.getItem('pending_punches') || '[]');
                pending.push(punchData); localStorage.setItem('pending_punches', JSON.stringify(pending));
                alert('Offline: Ponto salvo localmente! ⚡');
            }
            setCapturedPhoto(null); setCurrentLocation(null); setJustification(''); setIsProcessing(false);
            if (onPunchSuccess) onPunchSuccess();
        } catch (error) { alert('Erro: ' + error.message); }
    };

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const isAway = currentUser?.status && currentUser.status !== 'ativo' && todayStr >= currentUser.statusStart && todayStr <= currentUser.statusEnd;

    return (
        <div className="space-y-6">
            {(isAway && !isProcessing) ? (
                <div className="bg-orange-500/10 border border-orange-500/20 p-8 text-center rounded-2xl">
                    <p className="text-4xl mb-4">🏠</p>
                    <p className="text-orange-500 font-black text-xs uppercase tracking-widest">Acesso Negado: {currentUser.status.toUpperCase()}</p>
                    <p className="text-[10px] text-gray-500 mt-2">Você está afastado até {currentUser.statusEnd.split('-').reverse().join('/')}</p>
                </div>
            ) : !isProcessing && !capturedPhoto ? (
                <div className="grid grid-cols-2 gap-4">
                    {Object.entries(PUNCH_TYPES).map(([k, v]) => (
                        <button key={v} onClick={() => setSelectedType(v)} className={`p-5 border rounded-xl transition-all ${selectedType === v ? 'bg-primary-500/10 border-primary-500 text-primary-500' : 'bg-white/2 border-white/5 text-gray-400'}`}>
                            <div className="text-2xl mb-2">{v === 'entrada' ? '🌅' : v === 'saida' ? '🌙' : '🍽️'}</div>
                            <div className="text-[10px] font-black uppercase tracking-tight">{PUNCH_LABELS[v]}</div>
                        </button>
                    ))}
                    <button onClick={handlePunch} className="col-span-2 mt-4 bg-primary-500 text-black py-5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary-400">📸 Bater Ponto</button>
                </div>
            ) : showCamera ? (
                <div className="space-y-4">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video bg-black rounded-2xl object-cover grayscale" />
                    <div className="flex gap-4">
                        <button onClick={() => setShowCamera(false)} className="flex-1 py-4 border border-white/10 text-xs font-black uppercase">Cancelar</button>
                        <button onClick={capturePhoto} className="flex-1 py-4 bg-primary-500 text-black text-xs font-black uppercase">Capturar</button>
                    </div>
                </div>
            ) : capturedPhoto && (
                <div className="space-y-4">
                    <img src={capturedPhoto} className="w-full aspect-video object-cover rounded-2xl border-2 border-primary-500" />
                    <textarea value={justification} onChange={e => setJustification(e.target.value)} placeholder="JUSTIFICATIVA (OPCIONAL)" className="w-full bg-white/5 border border-white/10 p-4 text-xs font-mono uppercase text-white outline-none" />
                    <button onClick={confirmPunch} className="w-full py-5 bg-primary-500 text-black font-black uppercase tracking-widest">Confirmar Registro</button>
                </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default PunchButton;
