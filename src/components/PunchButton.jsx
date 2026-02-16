import { useState, useRef, useEffect } from 'react';
import { PUNCH_TYPES, PUNCH_LABELS } from '../config/firebase';
import { db, auth } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const PunchButton = () => {
    const [selectedType, setSelectedType] = useState(PUNCH_TYPES.ENTRADA);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [currentLocation, setCurrentLocation] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
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
                        timestamp: serverTimestamp(), // Firebase usará o tempo do servidor para o registro
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

        // Tentar sincronizar ao carregar e quando a internet voltar
        syncPendingPunches();
        window.addEventListener('online', syncPendingPunches);

        // Check local storage periodically or on mount
        const checkLocal = () => {
            const p = JSON.parse(localStorage.getItem('pending_punches') || '[]');
            setPendingCount(p.length);
        };
        checkLocal();

        return () => window.removeEventListener('online', syncPendingPunches);
    }, [isSyncing]);

    const requestPermissions = async () => {
        try {
            // Verificar Geolocalização
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

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
                audio: false
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setShowCamera(true);
            }
        } catch (error) {
            throw new Error('Não foi possível acessar a câmera. Permita o acesso e tente novamente.');
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

            // Parar stream da câmera
            const stream = video.srcObject;
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
            setShowCamera(false);
        }
    };

    const handlePunch = async () => {
        setIsProcessing(true);

        try {
            // 1. Verificar localização
            const { location } = await requestPermissions();
            setCurrentLocation(location);

            // 2. Abrir câmera
            await startCamera();

            // Aguardar captura de foto (será feito pelo botão "Tirar Foto")

        } catch (error) {
            alert(error.message);
            setIsProcessing(false);
        }
    };

    const confirmPunch = async () => {
        try {
            if (!auth.currentUser) throw new Error('Usuário não autenticado.');

            const punchData = {
                userId: auth.currentUser.uid,
                userName: auth.currentUser.displayName || 'Funcionário',
                type: selectedType,
                location: currentLocation,
                photo: capturedPhoto,
                date: new Date().toISOString().slice(0, 10),
                offlineTimestamp: new Date().toISOString() // Backup para batidas offline
            };

            if (navigator.onLine) {
                // Salvar no Firebase normalmente
                await addDoc(collection(db, 'punches'), {
                    ...punchData,
                    timestamp: serverTimestamp()
                });
                alert('Ponto registrado com sucesso! (Online)');
            } else {
                // Salvar no LocalStorage para sincronizar depois
                const pending = JSON.parse(localStorage.getItem('pending_punches') || '[]');
                pending.push(punchData);
                localStorage.setItem('pending_punches', JSON.stringify(pending));
                setPendingCount(pending.length);
                alert('Você está offline. O ponto foi salvo e será enviado assim que houver internet! 📡');
            }

            // Reset
            setCapturedPhoto(null);
            setCurrentLocation(null);
            setIsProcessing(false);
        } catch (error) {
            alert('Erro ao registrar ponto: ' + error.message);
        }
    };

    const cancelPunch = () => {
        setCapturedPhoto(null);
        setShowCamera(false);
        setIsProcessing(false);

        // Parar câmera se estiver ativa
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject;
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
        }
    };

    return (
        <div className="space-y-6">
            {!isProcessing && !capturedPhoto && (
                <div className="animate-fade-in">
                    <h3 className="text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.3em] mb-6 text-center italic">
                        Seleção_Tipo_Operação
                    </h3>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        {Object.entries(PUNCH_TYPES).map(([key, value]) => (
                            <button
                                key={value}
                                onClick={() => setSelectedType(value)}
                                className={`p-5 border transition-all active:scale-95 text-left relative overflow-hidden group ${selectedType === value
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
                                            value === 'volta_almoco' ? '↩️' : '🌙'}
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-widest leading-tight">
                                    {PUNCH_LABELS[value].replace(' ', '_')}
                                </div>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handlePunch}
                        className="w-full bg-emerald-500 text-black py-5 font-black text-xs uppercase tracking-[0.3em] hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)] relative active:scale-[0.98]"
                    >
                        📸 Iniciar_Captura_Facial
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
                                Sincronizando_Dados_Offline...
                            </p>
                        </div>
                    )}
                </div>
            )}

            {showCamera && (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] italic">
                            Scan_Biométrico_Facial
                        </h3>
                        <span className="text-[8px] font-mono text-gray-600">REQ_AUTH_V2</span>
                    </div>

                    <div className="relative aspect-video bg-black border-2 border-white/10 overflow-hidden shadow-2xl">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover grayscale"
                        />
                        <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-dashed border-emerald-500/50 rounded-full animate-pulse"></div>
                        <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-emerald-500"></div>
                        <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-emerald-500"></div>
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

                    <div className="flex gap-4">
                        <button
                            onClick={cancelPunch}
                            className="flex-1 py-4 border border-white/10 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all active:scale-95"
                        >
                            Refazer
                        </button>
                        <button
                            onClick={confirmPunch}
                            className="flex-1 py-4 bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg active:scale-95"
                        >
                            ✅ Confirmar_Ponto
                        </button>
                    </div>
                </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default PunchButton;
