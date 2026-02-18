import { useState, useEffect } from 'react';

const InstallButton = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSHint, setShowIOSHint] = useState(false);

    useEffect(() => {
        // Detecção de iOS
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

        if (isIOSDevice && !isStandalone) {
            setIsIOS(true);
            setIsVisible(true);
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        });

        window.addEventListener('appinstalled', (evt) => {
            setIsVisible(false);
        });
    }, []);

    const handleInstallClick = async () => {
        if (isIOS) {
            setShowIOSHint(true);
            return;
        }

        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="relative">
            <button
                onClick={handleInstallClick}
                className="flex items-center gap-2 bg-primary-500/10 border border-primary-500/30 text-primary-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-primary-500 hover:text-black transition-all rounded-sm"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {isIOS ? 'Como Instalar no iPhone' : 'Instalar App'}
            </button>

            {showIOSHint && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
                    <div className="bg-gray-900 border border-primary-500/20 p-8 rounded-3xl max-w-sm w-full animate-fade-in text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-primary-500"></div>
                        <button onClick={() => setShowIOSHint(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl font-bold p-2">×</button>

                        <div className="text-4xl mb-4">📱</div>
                        <h3 className="text-white font-black uppercase tracking-widest mb-4">Instalar no iPhone</h3>

                        <div className="space-y-6 text-left text-xs text-gray-400 font-mono uppercase">
                            <div className="flex items-start gap-3">
                                <span className="text-primary-500 font-black">01.</span>
                                <span>Toque no ícone de <span className="text-white font-black italic">COMPARTILHAR</span> (quadrado com seta pra cima) na barra inferior do Safari.</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-primary-500 font-black">02.</span>
                                <span>Role a lista para baixo e toque em <span className="text-white font-black italic">ADICIONAR À TELA DE INÍCIO</span>.</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-primary-500 font-black">03.</span>
                                <span>Confirme em <span className="text-white font-black italic">ADICIONAR</span> no canto superior direito.</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowIOSHint(false)}
                            className="w-full mt-8 py-4 bg-primary-500 text-black font-black uppercase text-[10px] tracking-widest rounded-xl"
                        >
                            Entendi, Raquel!
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstallButton;
