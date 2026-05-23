import React from 'react';
import type { LucideProps } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ComponentType<LucideProps>;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    icon: Icon,
    className = '',
    ...props
}) => {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-white/70 mb-2">
                    {label}
                </label>
            )}
            <div className="relative">
                {Icon && (
                    <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400/50" />
                )}
                <input
                    className={`
                        w-full bg-dark-900/50 border border-primary-500/20
                        rounded-xl px-4 py-2.5
                        text-white placeholder-white/30
                        focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50
                        transition-all duration-200
                        ${Icon ? 'pl-12' : ''}
                        ${error ? 'border-danger-500' : ''}
                        ${className}
                    `}
                    {...props}
                />
            </div>
            {error && (
                <p className="mt-1.5 text-sm text-danger-400">{error}</p>
            )}
        </div>
    );
};
