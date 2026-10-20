import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Share, PlusSquare, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'banner' | 'pill' }> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { language, t } = useLanguage();

  // If already installed and launched from phone home screen, hide prompt
  if (isInstalled) {
    return null;
  }

  // Android / Chromium / Desktop prompt
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs shadow-md border border-amber-300 hover:from-amber-400 hover:to-amber-500 active:scale-95 transition-all"
        title={t('install_mobile_app')}
      >
        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
        <span className="hidden sm:inline">{t('install_app')}</span>
      </button>
    );
  }

  // iOS Safari flow (Apple Safari does not fire beforeinstallprompt event)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-900 text-amber-300 font-bold text-xs shadow-xs border border-amber-400/40 hover:bg-slate-800 active:scale-95 transition-all"
          title="Install on iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('ios_app')}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-slate-900 relative animate-in fade-in zoom-in-95">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-950 flex items-center justify-center p-2 text-amber-400 shadow-md">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-base text-slate-900">
                    {t('install_on_iphone_ipad')}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Add Adatya to your Apple Home Screen
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-700">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <div>
                    Safari मध्ये खालील <strong>Share</strong> बटणावर टॅप करा
                    <div className="mt-1 flex items-center gap-1.5 text-blue-600 font-semibold">
                      <Share className="w-4 h-4" /> Share icon in Safari toolbar
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <div>
                    खाली स्क्रोल करा आणि <strong>'Add to Home Screen'</strong> वर टॅप करा
                    <div className="mt-1 flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <PlusSquare className="w-4 h-4" /> 'Add to Home Screen' (होम स्क्रीनवर जोडा)
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <div>
                    वर उजव्या कोपऱ्यात <strong>'Add'</strong> दाबा. आता तुमच्या फोनवर थेट ॲप दिसेल!
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 bg-emerald-950 hover:bg-emerald-900 text-amber-300 font-bold text-xs rounded-xl shadow-md transition-colors"
              >
                {t('done')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback banner for browsers if needed
  return null;
};
