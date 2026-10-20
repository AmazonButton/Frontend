import React from 'react';
import { Check, X } from 'lucide-react';

export interface PasswordCriteria {
  minLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export const checkPasswordCriteria = (password: string): PasswordCriteria => {
  return {
    minLength: password.length >= 8,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
};

export const getPasswordScore = (criteria: PasswordCriteria): number => {
  let score = 0;
  if (criteria.minLength) score += 1;
  if (criteria.hasLower) score += 0.5;
  if (criteria.hasUpper) score += 0.5;
  if (criteria.hasNumber) score += 1;
  if (criteria.hasSpecial) score += 1;
  return Math.min(4, Math.floor(score));
};

export const PasswordStrengthMeter: React.FC<{ password: string; showCriteria?: boolean }> = ({
  password,
  showCriteria = true,
}) => {
  if (!password) return null;

  const criteria = checkPasswordCriteria(password);
  const score = getPasswordScore(criteria);

  // Score config: 1 = Yếu, 2 = Trung bình, 3 = Mạnh, 4 = Rất mạnh
  const levels = [
    { label: 'Rất yếu', color: 'bg-rose-500', textColor: 'text-rose-500', width: 'w-1/4' },
    { label: 'Yếu', color: 'bg-rose-500', textColor: 'text-rose-500', width: 'w-1/4' },
    { label: 'Trung bình', color: 'bg-amber-500', textColor: 'text-amber-500', width: 'w-2/4' },
    { label: 'Mạnh', color: 'bg-blue-500', textColor: 'text-blue-500', width: 'w-3/4' },
    { label: 'Rất mạnh', color: 'bg-emerald-500', textColor: 'text-emerald-500', width: 'w-full' },
  ];

  const currentLevel = levels[score];

  const checklistItems = [
    { label: 'Tối thiểu 8 ký tự', met: criteria.minLength },
    { label: 'Chữ in hoa (A-Z)', met: criteria.hasUpper },
    { label: 'Chữ in thường (a-z)', met: criteria.hasLower },
    { label: 'Chữ số (0-9)', met: criteria.hasNumber },
    { label: 'Ký tự đặc biệt (!@#$...)', met: criteria.hasSpecial },
  ];

  return (
    <div className="space-y-2 mt-2 animate-in fade-in duration-200">
      <div className="flex items-center justify-between text-[11px] font-mono font-semibold">
        <span className="text-slate-500 dark:text-slate-400">Độ mạnh mật khẩu:</span>
        <span className={currentLevel.textColor}>{currentLevel.label}</span>
      </div>

      {/* Strength Bar */}
      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${currentLevel.color} ${currentLevel.width}`}
        />
      </div>

      {/* Criteria Checklist */}
      {showCriteria && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1.5">
          {checklistItems.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-1.5 text-[11px] transition-colors ${
                item.met
                  ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {item.met ? (
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <X className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
              )}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
