import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { STAFF_ROLE_LABELS, STAFF_ROLE_BADGE_CLASSES } from '../../services/permissions';
import { Lock, X, Delete, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

export const PinLockModal: React.FC = () => {
  const {
    isPinModalOpen,
    closePinModal,
    employees,
    activeOperator,
    verifyOperatorPin,
  } = useApp();

  const activeList = employees.filter((e) => e.active);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    activeOperator?.id || activeList[0]?.id || ''
  );
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  if (!isPinModalOpen) return null;

  const currentSelectedId =
    activeList.some((e) => e.id === selectedEmpId)
      ? selectedEmpId
      : activeOperator?.id || activeList[0]?.id || '';

  const handleDigit = (digit: string) => {
    if (pin.length >= 6 || isChecking) return;
    setError('');
    setPin((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setError('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentSelectedId || pin.length < 4) {
      setError('Saisissez votre code PIN à 4 chiffres.');
      return;
    }
    setIsChecking(true);
    setError('');
    try {
      const res = await verifyOperatorPin(currentSelectedId, pin);
      if (!res.success) {
        setError(res.error || 'Code PIN incorrect.');
        setPin('');
      } else {
        setPin('');
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-[#123B67] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-[#F58220]" />
            <div>
              <h3 className="font-bold text-sm">Changement d’Opérateur (PIN)</h3>
              <p className="text-[11px] text-blue-200">
                Sélectionnez un employé et validez son code PIN rapide
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setPin('');
              setError('');
              closePinModal();
            }}
            className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Employee selector */}
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {activeList.map((emp) => {
              const isSelected = emp.id === currentSelectedId;
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    setSelectedEmpId(emp.id);
                    setError('');
                    setPin('');
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-colors ${
                    isSelected
                      ? 'border-[#F58220] bg-orange-50/60'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{emp.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {emp.storeIds.length === 0 ? 'Toutes boutiques' : `${emp.storeIds.length} boutique(s)`}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${STAFF_ROLE_BADGE_CLASSES[emp.role]}`}
                  >
                    {STAFF_ROLE_LABELS[emp.role]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* PIN Dots Display */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center space-y-1.5">
            <div className="flex justify-center gap-3 py-1">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    idx < pin.length
                      ? 'bg-[#123B67] border-[#123B67] scale-110'
                      : 'bg-white border-slate-300'
                  }`}
                />
              ))}
              {pin.length > 4 &&
                Array.from({ length: pin.length - 4 }).map((_, idx) => (
                  <div
                    key={`extra-${idx}`}
                    className="w-4 h-4 rounded-full bg-[#123B67] border-2 border-[#123B67]"
                  />
                ))}
            </div>
            <div className="text-[10px] text-slate-400">
              Saisissez le code PIN personnel de l’opérateur sélectionné
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Touch Numeric Keypad (>=48px tap targets) */}
          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(d)}
                className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 font-mono font-bold text-lg text-slate-900 transition-colors"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBackspace}
              className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
              aria-label="Effacer"
            >
              <Delete className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 font-mono font-bold text-lg text-slate-900 transition-colors"
            >
              0
            </button>
            <button
              type="button"
              disabled={pin.length < 4 || isChecking}
              onClick={() => handleSubmit()}
              className="h-12 rounded-xl bg-[#F58220] hover:bg-[#E07315] disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors"
            >
              {isChecking ? (
                <ShieldCheck className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valider</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
