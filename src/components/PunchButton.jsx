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

    // Efeito para sincronizar pontos salvos offline
    useEffect(() => {
        const syncPendingPunches = async () => {
            if (!navigator.onLine || isSyncing) return;

            const pending = JSON.parse(localStorage.getItem('pending_punches') || '[]');
            if (pending.length === 0) {
                setPendingCount(0);
                return;
            }

            setIsSyncing(true);
            const remaining = [];

            for (const punch of pending) {
                try {
                    await addDoc(collection(db, 'punches'), {
                        ...punch,
                        timestamp: serverTimestamp(),
                        isOffline: true
                    });
                } catch (error) {
                    console.error("Erro ao sincronizar ponto offline:", error);
                    remaining.push(punch);
                }
            }

            localStorage.setItem('pending_punches', JSON.stringify(remaining));
            setPendingCount(remaining.length);
            setIsSyncing(false);
        };

        syncPendingPunches();
        window.addEventListener('online', syncPendingPunches);

        const checkLocal = () => {
            const p = JSON.parse(localStorage.getItem('pending_punches') || '[]');
            setPendingCount(p.length);
        };
        checkLocal();

        return () => window.removeEventListener('online', syncPendingPunches);
    }, [isSyncing]);

    const requestPermissions = async () => {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000
                });
            });

            return {
                location: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                }
            };
        } catch (error) {
            throw new Error('Não foi possível obter sua localização. Ative o GPS e tente novamente.');
        }
    };

    useEffect(() => {
        if (showCamera && cameraStream && videoRef.current) {
            videoRef.current.srcObject = cameraStream;
            videoRef.current.play().catch(err => console.error("Erro ao dar play no vídeo:", err));
        }
    }, [showCamera, cameraStream]);

    const startCamera = async () => {
        try {
            setShowCamera(true);
            const constraints = { video: { facingMode: 'user' }, audio: false };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setCameraStream(stream);
        } catch (error) {
            console.error('Erro detalhado da câmera:', error);
            try {
                const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
                setCameraStream(fallbackStream);
            } catch (fallbackError) {
                setShowCamera(false);
                throw new Error(`Câmera bloqueada ou indisponível: ${error.message}`);
            }
        }
    };

    const capturePhoto = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video && canvas) {
            const context = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);

            const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setCapturedPhoto(photoDataUrl);

            const stream = video.srcObject;
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
            setShowCamera(false);
        }
    };

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

        return R * c;
    }

    const handlePunch = async () => {
        setIsProcessing(true);

        try {
            // 1. Verificar localização
            const { location } = await requestPermissions();
            setCurrentLocation(location);

            // Validar Cerca Virtual (Se tiver empresa configurada)
            if (currentCompany && currentCompany.location) {
                const dist = calculateDistance(
                    location.latitude,
                    location.longitude,
                    currentCompany.location.latitude,
                    currentCompany.location.longitude
                );

                const maxRadius = currentCompany.radius || 100;

                if (dist > maxRadius) {
                    const confirm = window.confirm(`Você está a ${Math.round(dist)}m da empresa (Limite: ${maxRadius}m). Deseja registrar mesmo assim como 'Externo'?`);
                    if (!confirm) {
                        setIsProcessing(false);
                        return;
                    }
                }
            }

            // 2. Abrir câmera
            await startCamera();

        } catch (error) {
            alert(error.message);
            setIsProcessing(false);
            setJustification('');
        }
    };

    const confirmPunch = async () => {
        try {
            if (!auth.currentUser) throw new Error('Usuário não autenticado.');

            const now = new Date();
            const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            const punchData = {
                userId: auth.currentUser.uid,
                userName: currentUser?.name || auth.currentUser.displayName || 'Funcionário',
                type: selectedType,
                location: currentLocation,
                photo: capturedPhoto,
                justification: justification || '',
                date: localDate,
                offlineTimestamp: now.toISOString()
            };

            if (navigator.onLine) {
                await addDoc(collection(db, 'punches'), {
                    ...punchData,
                    timestamp: serverTimestamp()
                });
                alert('Ponto registrado com sucesso! (Online)');
            } else {
                const pending = JSON.parse(localStorage.getItem('pending_punches') || '[]');
                pending.push(punchData);
                localStorage.setItem('pending_punches', JSON.stringify(pending));
                setPendingCount(pending.length);
                alert('Você está offline. O ponto foi salvo e será enviado assim que houver internet! 📡');
            }

            setCapturedPhoto(null);
            setCurrentLocation(null);
            setJustification('');
            setIsProcessing(false);

            if (onPunchSuccess) onPunchSuccess();
        } catch (error) {
            alert('Erro ao registrar ponto: ' + error.message);
        }
    };

    const cancelPunch = () => {
        setCapturedPhoto(null);
        setShowCamera(false);
        setIsProcessing(false);

        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
    };

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isAway = currentUser?.status &&
        currentUser.status !== 'ativo' &&
        currentUser.statusStart &&
        currentUser.statusEnd &&
        todayStr >= currentUser.statusStart &&
        todayStr <= currentUser.statusEnd;

    return (
        <div className="space-y-6">
            {isAway && (
                <div className="bg-orange-500/10 border-2 border-orange-500/30 p-8 rounded-2xl text-center animate-fade-in mb-6">
                    <p className="text-4xl mb-4">🏠</p>
                    <h4 className="text-orange-500 font-black uppercase tracking-[0.2em] text-xs mb-2">Acesso Restrito</h4>
                    <p className="text-gray-400 text-[10px] font-mono uppercase tracking-widest leading-relaxed">
                        Você está registrado como <span className="text-orange-500 font-black">{currentUser.status === 'ferias' ? 'EM FÉRIAS' : 'AFASTADO'}</span> até o dia <span className="text-white font-black">{currentUser.statusEnd.split('-').reverse().join('/')}</span>.
                    </p>
                    <p className="text-[8px] text-gray-600 uppercase mt-4">Procure a administração para qualquer alteração.</p>
                </div>
            )}

            {!isAway && !isProcessing && !capturedPhoto && (
                <div className="animate-fade-in">
                    <h3 className="text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.3em] mb-6 text-center italic">
                        Seleção_Tipo_Operação
                    </h3>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        {Object.entries(PUNCH_TYPES).map(([key, value]) => (
                            <button
                                key={value}
                                onClick={() => setSelectedType(value)}
                                className={`p-5 border rounded-xl transition-all active:scale-95 text-left relative overflow-hidden group ${selectedType === value
                                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500'
                                    : 'bg-white/2 border-white/5 text-gray-400 hover:border-white/20'
                                    }`}
                            >
                                <div className="absolute top-0 right-0 p-1 opacity-10">
                                    <div className="w-8 h-8 border-t border-r border-current"></div>
                                </div>
                                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                                    {value === 'entrada' ? '🌅' :
                                        value === 'saida_almoco' ? '🍽️' :
                                            value === 'volta_almoco' ? '↩️' :
                                                value === 'saida_eventual' ? '🚪' :
                                                    value === 'volta_eventual' ? '🔙' : '🌙'}
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-widest leading-tight">
                                    {PUNCH_LABELS[value]}
                                </div>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handlePunch}
                        className="w-full bg-emerald-500 text-black py-5 rounded-xl font-black text-xs uppercase tracking-[0.3em] hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)] relative active:scale-[0.98]"
                    >
                        📸 Iniciar Captura Facial
                        {pendingCount > 0 && (
                            <span className="absolute -top-3 -right-3 bg-red-500 text-white text-[10px] font-black w-7 h-7 rounded-none flex items-center justify-center border-2 border-black animate-pulse shadow-lg">
                                {pendingCount}
                            </span>
                        )}
                    </button>

                    {isSyncing && (
                        <div className="flex items-center justify-center gap-3 mt-6">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                            <p className="text-[8px] font-mono text-emerald-500/60 uppercase tracking-[0.4em] font-black">
                                Sincronizando Dados Offline...
                            </p>
                        </div>
                    )}
                </div>
            )}

            {showCamera && (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] italic">
                            Scan Biométrico Facial
                        </h3>
                        <span className="text-[8px] font-mono text-gray-600">REQ_AUTH_V2</span>
                    </div>

                    <div className="bg-black/60 backdrop-blur-2xl border-2 border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden animate-fade-in relative">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover grayscale"
                        />
                        <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-dashed border-emerald-500/50 rounded-full animate-pulse"></div>
                        <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-emerald-500"></div>
                        <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-emerald-500"></div>
                        <div className="absolute top-2 right-2 bg-emerald-500 text-black px-2 py-1 font-black text-[8px] uppercase tracking-widest">
                            Preview_OK
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={cancelPunch}
                            className="flex-1 py-4 border border-white/10 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all active:scale-95"
                        >
                            Abortar
                        </button>
                        <button
                            onClick={capturePhoto}
                            className="flex-1 py-4 bg-white/10 border border-white/20 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all active:scale-95"
                        >
                            📸 Capturar
                        </button>
                    </div>
                </div>
            )}

            {capturedPhoto && (
                <div className="space-y-6 animate-fade-in">
                    <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] text-center italic">
                        Validar_Registro_Visual
                    </h3>

                    <div className="relative aspect-video bg-black border-2 border-emerald-500/30 overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                        <img src={capturedPhoto} alt="Foto capturada" className="w-full h-full object-cover" />
                        <div className="absolute top-4 left-4 bg-emerald-500 text-black px-2 py-1 text-[8px] font-black uppercase tracking-widest">
                            Scan_OK
                        </div>
                    </div>

                    <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 font-mono">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[8px] text-emerald-500/40 uppercase font-black">Operação</span>
                            <span className="text-[10px] text-emerald-500 font-black uppercase">{PUNCH_LABELS[selectedType]}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[8px] text-emerald-500/40 uppercase font-black">Timestamp</span>
                            <span className="text-[10px] text-white font-black">{new Date().toLocaleTimeString('pt-BR')}</span>
                        </div>
                    </div>

                    <div className="space-y-2 px-1">
                        <label className="block text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] pl-1">Observação / Justificativa (Opcional)</label>
                        <textarea
                            className="w-full bg-black/40 border border-white/10 p-4 focus:border-emerald-500 outline-none font-mono text-xs text-white h-24 uppercase tracking-tighter resize-none"
                            placeholder="EX: CONSULTA MÉDICA, SERVIÇO EXTERNO, ETC..."
                            value={justification}
                            onChange={e => setJustification(e.target.value)}
                        ></textarea>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={cancelPunch}
                            className="flex-1 py-4 border border-white/10 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all active:scale-95"
                        >
                            Refazer
                        </button>
                        <button
                            onClick={confirmPunch}
                            className="flex-1 py-4 bg-emerald-500 text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg active:scale-95"
                        >
                            Confirmar Registro
                        </button>
                    </div>
                </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default PunchButton;
