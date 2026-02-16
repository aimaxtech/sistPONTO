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
        <div className="card">
            {!isProcessing && !capturedPhoto && (
                <>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                        Selecione o tipo de registro
                    </h3>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {Object.entries(PUNCH_TYPES).map(([key, value]) => (
                            <button
                                key={value}
                                onClick={() => setSelectedType(value)}
                                className={`p-4 rounded-lg border-2 transition-all ${selectedType === value
                                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <div className="text-2xl mb-2">
                                    {value === 'entrada' ? '🌅' :
                                        value === 'saida_almoco' ? '🍽️' :
                                            value === 'volta_almoco' ? '↩️' : '🌙'}
                                </div>
                                <div className="text-sm font-medium">
                                    {PUNCH_LABELS[value]}
                                </div>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handlePunch}
                        className="btn-primary w-full text-lg py-4 relative"
                    >
                        📸 Registrar Ponto
                        {pendingCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                                {pendingCount}
                            </span>
                        )}
                    </button>

                    {isSyncing && (
                        <p className="text-[10px] text-center mt-3 text-primary-600 font-bold animate-pulse uppercase tracking-widest">
                            Sincronizando registros offline...
                        </p>
                    )}
                </>
            )}

            {showCamera && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 text-center">
                        Tire uma foto do seu rosto
                    </h3>

                    <div className="relative bg-black rounded-lg overflow-hidden">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full"
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={cancelPunch}
                            className="btn-secondary flex-1"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={capturePhoto}
                            className="btn-primary flex-1"
                        >
                            📸 Tirar Foto
                        </button>
                    </div>
                </div>
            )}

            {capturedPhoto && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 text-center">
                        Confirme sua foto
                    </h3>

                    <div className="relative bg-black rounded-lg overflow-hidden">
                        <img src={capturedPhoto} alt="Foto capturada" className="w-full" />
                    </div>

                    <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                        <p className="text-sm text-primary-800 font-medium">
                            📍 Tipo: {PUNCH_LABELS[selectedType]}
                        </p>
                        <p className="text-sm text-primary-700 mt-1">
                            🕒 Horário: {new Date().toLocaleTimeString('pt-BR')}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={cancelPunch}
                            className="btn-secondary flex-1"
                        >
                            Refazer
                        </button>
                        <button
                            onClick={confirmPunch}
                            className="btn-primary flex-1"
                        >
                            ✅ Confirmar
                        </button>
                    </div>
                </div>
            )}

            {/* Canvas oculto para captura */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default PunchButton;
