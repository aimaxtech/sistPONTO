import { useState, useRef, useEffect } from 'react';
import { PUNCH_TYPES, PUNCH_LABELS, GREENHOUSE_LOCATION } from '../config/firebase';
import { db, auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const PunchButton = ({ onPunchSuccess, lastPunch }) => {
    const { currentUser, currentCompany } = useAuth();
    const [selectedType, setSelectedType] = useState(PUNCH_TYPES.ENTRADA);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false); // Novo estado para o segundo botão
    const [showCamera, setShowCamera] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [currentLocation, setCurrentLocation] = useState(null);
    const [gpsAccuracy, setGpsAccuracy] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [cameraStream, setCameraStream] = useState(null);
    const [justification, setJustification] = useState('');
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // Auto-seleção do próximo tipo de ponto
    useEffect(() => {
        if (!lastPunch) {
            setSelectedType(PUNCH_TYPES.ENTRADA);
        } else {
            switch (lastPunch.type) {
                case PUNCH_TYPES.ENTRADA:
                    setSelectedType(PUNCH_TYPES.SAIDA_ALMOCO);
                    break;
                case PUNCH_TYPES.SAIDA_ALMOCO:
                    setSelectedType(PUNCH_TYPES.VOLTA_ALMOCO);
                    break;
                case PUNCH_TYPES.VOLTA_ALMOCO:
                case PUNCH_TYPES.VOLTA_EVENTUAL:
                    setSelectedType(PUNCH_TYPES.SAIDA);
                    break;
                case PUNCH_TYPES.SAIDA:
                    // Se já saiu, talvez queira entrar de novo (turno extra) ou apenas mantém saída
                    setSelectedType(PUNCH_TYPES.ENTRADA);
                    break;
                default:
                    setSelectedType(PUNCH_TYPES.ENTRADA);
            }
        }
    }, [lastPunch]);

    useEffect(() => {
        const syncPendingPunches = async () => {
            if (!navigator.onLine || isSyncing) return;
            const pending = JSON.parse(localStorage.getItem('pending_logs') || '[]');
            if (pending.length === 0) { setPendingCount(0); return; }
            setIsSyncing(true);
            const remaining = [];
            for (const punch of pending) {
                try {
                    await addDoc(collection(db, 'logs'), { ...punch, timestamp: serverTimestamp(), isOffline: true });
                } catch (error) { console.error(error); remaining.push(punch); }
            }
            localStorage.setItem('pending_logs', JSON.stringify(remaining));
            setPendingCount(remaining.length); setIsSyncing(false);
        };
        syncPendingPunches();
        window.addEventListener('online', syncPendingPunches);
        return () => window.removeEventListener('online', syncPendingPunches);
    }, [isSyncing]);

    const requestPermissions = async () => {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                });
            });

            // Validação de Precisão (Evitar Spoofing ou sinal ruim)
            if (position.coords.accuracy > 150) {
                throw new Error(`Sinal GPS fraco (Precisão: ${Math.round(position.coords.accuracy)}m). Tente ir para um local aberto.`);
            }

            setGpsAccuracy(position.coords.accuracy);
            return { location: { latitude: position.coords.latitude, longitude: position.coords.longitude } };
        } catch (error) {
            throw new Error(error.message || 'Ative o GPS para registrar o ponto.');
        }
    };

    const startCamera = async () => {
        try {
            setShowCamera(true);
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            setCameraStream(stream);
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (error) {
            try {
                const fallback = await navigator.mediaDevices.getUserMedia({ video: true });
                setCameraStream(fallback);
                if (videoRef.current) videoRef.current.srcObject = fallback;
            } catch (e) { setShowCamera(false); throw new Error('Acesso à câmera negado. Verifique as permissões.'); }
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0);

            // Adicionar timestamp na imagem (Watermark básica)
            ctx.font = "20px Monospace";
            ctx.fillStyle = "white";
            ctx.fillText(new Date().toLocaleString(), 20, canvasRef.current.height - 20);

            setCapturedPhoto(canvasRef.current.toDataURL('image/jpeg', 0.8));
            if (cameraStream) {
                cameraStream.getTracks().forEach(t => t.stop());
            }
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
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const { location } = await requestPermissions();
            setCurrentLocation(location);

            if (currentCompany?.latitude && currentCompany?.longitude) {
                const dist = calculateDistance(location.latitude, location.longitude, currentCompany.latitude, currentCompany.longitude);
                if (dist > (currentCompany.radius || GREENHOUSE_LOCATION.radius || 100)) {
                    if (!window.confirm(`Você está fora da área permitida (${Math.round(dist)}m). Tem certeza que deseja registrar como ponto externo?`)) {
                        setIsProcessing(false); return;
                    }
                }
            }
            await startCamera();
        } catch (error) {
            alert(error.message);
            setIsProcessing(false);
        }
    };

    const confirmPunch = async () => {
        if (isConfirming) return; // Proteção contra clique duplo
        setIsConfirming(true);
        try {
            const now = new Date();
            const companyIdFinal = currentCompany?.id || currentUser?.companyId || '';

            if (!companyIdFinal) {
                throw new Error("Vínculo administrativo não detectado. Contate o administrador para sincronizar sua conta.");
            }

            const punchData = {
                userId: auth.currentUser.uid,
                userName: currentUser?.name || 'Funcionário',
                companyId: companyIdFinal,
                type: selectedType,
                location: currentLocation,
                gpsAccuracy: gpsAccuracy,
                photo: capturedPhoto,
                justification: justification || '',
                date: now.toISOString().split('T')[0],
                offlineTimestamp: now.toISOString(),
                deviceInfo: navigator.userAgent
            };

            if (navigator.onLine) {
                await addDoc(collection(db, 'logs'), { ...punchData, timestamp: serverTimestamp() });
                alert('Ponto registrado com sucesso! ✅');
            } else {
                const pending = JSON.parse(localStorage.getItem('pending_logs') || '[]');
                pending.push(punchData);
                localStorage.setItem('pending_logs', JSON.stringify(pending));
                alert('Modo Offline: Ponto salvo localmente e será sincronizado quando houver internet. ⚡');
            }

            setCapturedPhoto(null);
            setCurrentLocation(null);
            setJustification('');
            setIsProcessing(false);
            setIsConfirming(false);
            if (onPunchSuccess) onPunchSuccess();
        } catch (error) {
            alert('Erro ao registrar: ' + error.message);
            setIsConfirming(false);
        }
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
                    <p className="text-[10px] text-gray-500 mt-2">Você está afastado até {currentUser.statusEnd?.split('-').reverse().join('/')}</p>
                </div>
            ) : !isProcessing && !capturedPhoto ? (
                <div className="grid grid-cols-2 gap-4">
                    {Object.entries(PUNCH_TYPES).map(([k, v]) => (
                        <button
                            key={v}
                            onClick={() => setSelectedType(v)}
                            className={`p-5 border rounded-xl transition-all ${selectedType === v ? 'bg-primary-500/10 border-primary-500 text-primary-500 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]' : 'bg-white/2 border-white/5 text-gray-400 opacity-60'}`}
                        >
                            <div className="text-2xl mb-2">{v === 'entrada' ? '🌅' : v === 'saida' ? '🌙' : '🍽️'}</div>
                            <div className="text-[10px] font-black uppercase tracking-tight">{PUNCH_LABELS[v]}</div>
                        </button>
                    ))}
                    <button
                        onClick={handlePunch}
                        disabled={isProcessing}
                        className="col-span-2 mt-4 bg-primary-500 text-black py-5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary-400 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {isProcessing ? 'Processando Localization...' : '📸 Bater Ponto'}
                    </button>
                </div>
            ) : showCamera ? (
                <div className="space-y-4 animate-fade-in">
                    <div className="relative overflow-hidden rounded-2xl bg-black aspect-video border border-white/10">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale" />
                        <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 rounded text-[8px] font-mono text-primary-500 uppercase tracking-widest">LIVE_FEED_SECURE</div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => {
                            if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
                            setShowCamera(false);
                            setIsProcessing(false);
                        }} className="flex-1 py-4 border border-white/10 text-xs font-black uppercase hover:bg-white/5 rounded-xl transition-all">Cancelar</button>
                        <button onClick={capturePhoto} className="flex-1 py-4 bg-primary-500 text-black text-xs font-black uppercase hover:bg-primary-400 rounded-xl transition-all shadow-lg shadow-primary-500/20">Capturar Foto</button>
                    </div>
                </div>
            ) : capturedPhoto && (
                <div className="space-y-4 animate-fade-in">
                    <div className="relative">
                        <img src={capturedPhoto} className="w-full aspect-video object-cover rounded-2xl border-2 border-primary-500 shadow-2xl shadow-primary-500/10" />
                        <div className="absolute bottom-4 right-4 bg-primary-500 text-black px-2 py-1 text-[8px] font-black uppercase italic">Foto Verificada</div>
                    </div>
                    <div className="bg-black/40 border border-white/5 p-4 rounded-xl">
                        <p className="text-[8px] font-black text-gray-500 uppercase mb-2 tracking-widest">Localização Atual</p>
                        <p className="text-[10px] font-mono text-primary-500">LAT: {currentLocation?.latitude.toFixed(6)} | LON: {currentLocation?.longitude.toFixed(6)}</p>
                        <p className="text-[8px] text-gray-600 mt-1 uppercase">Precisão GPS: {Math.round(gpsAccuracy)}m</p>
                    </div>
                    <textarea
                        value={justification}
                        onChange={e => setJustification(e.target.value)}
                        placeholder="ALGO A DECLARAR NESTE REGISTRO?"
                        className="w-full bg-white/5 border border-white/10 p-4 text-xs font-mono uppercase text-white outline-none focus:border-primary-500 rounded-xl h-24 resize-none transition-all"
                    />
                    <button
                        onClick={confirmPunch}
                        disabled={isConfirming}
                        className="w-full py-5 bg-primary-500 text-black font-black uppercase tracking-widest hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xl shadow-primary-500/20 active:scale-95 transition-all"
                    >
                        {isConfirming ? 'Registrando na Nuvem...' : 'Finalizar Registro'}
                    </button>
                </div>
            )
            }
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default PunchButton;
