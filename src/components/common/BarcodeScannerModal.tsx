import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { X, ScanLine, Camera, RefreshCw, AlertCircle, Usb } from 'lucide-react';

interface BarcodeScannerModalProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ onScan, onClose }) => {
  const { products } = useApp();
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const hasScannedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    const startCamera = async () => {
      setCameraError('');
      try {
        const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        setDevices(videoInputDevices);

        const rearDevice =
          videoInputDevices.find((d) => /back|rear|environment|arrière/i.test(d.label)) ||
          videoInputDevices[videoInputDevices.length - 1];
        const targetDeviceId = selectedDeviceId || rearDevice?.deviceId;

        if (!videoRef.current) return;

        const controls = await reader.decodeFromVideoDevice(
          targetDeviceId,
          videoRef.current,
          (result) => {
            if (cancelled || hasScannedRef.current) return;
            if (result) {
              const code = result.getText().trim();
              if (code) {
                hasScannedRef.current = true;
                controls.stop();
                onScan(code);
                onClose();
              }
            }
          }
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setCameraActive(true);
      } catch (err: any) {
        if (cancelled) return;
        setCameraActive(false);
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'Accès caméra refusé. Autorisez la caméra dans votre navigateur ou utilisez la douchette USB / saisie manuelle.'
            : 'Caméra indisponible sur cet appareil. Utilisez un lecteur USB/Bluetooth ou saisissez le code.'
        );
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop();
      } catch {
        // ignore stop errors
      }
    };
  }, [selectedDeviceId, onScan, onClose]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      onClose();
    }
  };

  const availableProductsWithBarcode = products.filter((p) => p.barcode && p.active).slice(0, 12);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-[#F58220]" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Scanner Code-barres</h3>
              <p className="text-[11px] text-slate-500">Caméra Android / iPhone · Douchette USB & Bluetooth</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Live Camera Preview */}
          <div className="relative h-52 bg-slate-900 rounded-xl overflow-hidden flex flex-col items-center justify-center border-2 border-[#F58220]/40">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover ${cameraActive ? 'opacity-100' : 'opacity-20'}`}
            />

            {/* Reticle overlay */}
            <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-24 border-2 border-[#F58220]/70 rounded-xl pointer-events-none flex items-center">
              <div className="w-full h-0.5 bg-[#F58220] shadow-[0_0_12px_#F58220] animate-pulse" />
            </div>

            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-900/70">
                {cameraError ? (
                  <>
                    <AlertCircle className="w-7 h-7 text-amber-400 mb-2" />
                    <span className="text-xs text-slate-200 leading-relaxed max-w-xs">{cameraError}</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-7 h-7 text-slate-400 mb-2 animate-pulse" />
                    <span className="text-xs text-slate-300 font-medium">Démarrage de la caméra...</span>
                  </>
                )}
              </div>
            )}

            {devices.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const idx = devices.findIndex((d) => d.deviceId === selectedDeviceId);
                  const next = devices[(idx + 1) % devices.length];
                  if (next) setSelectedDeviceId(next.deviceId);
                }}
                className="absolute bottom-2 right-2 px-2.5 py-1.5 rounded-lg bg-slate-900/80 text-white text-[11px] font-medium flex items-center gap-1 hover:bg-slate-800"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Changer caméra</span>
              </button>
            )}
          </div>

          {/* Manual / USB Scanner Input */}
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Usb className="w-3.5 h-3.5 text-[#123B67]" />
              <span>Saisie manuelle ou Douchette USB / Bluetooth :</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                data-barcode-input="true"
                placeholder="Scannez ou tapez un code EAN-13 / SKU..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="flex-1 px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#F58220]/20 focus:border-[#F58220] font-mono"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] disabled:opacity-50 rounded-xl transition-colors"
              >
                Valider
              </button>
            </div>
          </form>

          {/* Quick Pick Inventory Barcodes */}
          {availableProductsWithBarcode.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Articles avec code-barres en stock :
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {availableProductsWithBarcode.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => {
                      onScan(prod.barcode!);
                      onClose();
                    }}
                    className="w-full text-left p-2 rounded-xl bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="truncate mr-2">
                      <div className="font-medium text-slate-800 truncate">{prod.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{prod.barcode}</div>
                    </div>
                    <span className="text-[10px] font-semibold text-[#123B67] bg-white px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                      Sélectionner
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
