import React from 'react';
import type { LucideProps } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    icon?: React.ComponentType<LucideProps>;
    iconPosition?: 'left' | 'right';
    isLoading?: boolean;
    children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconPosition = 'left',
    isLoading = false,
    children,
    className = '',
    disabled,
    ...props
}) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary: 'bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-400 hover:to-accent-500 text-white shadow-lg hover:shadow-glow-pink transform hover:scale-105 active:scale-95',
        secondary: 'bg-dark-800/80 hover:bg-dark-700/80 border border-dark-600/50 text-white transform hover:scale-105 active:scale-95',
        ghost: 'bg-transparent hover:bg-white/10 text-white/70 hover:text-white',
        danger: 'bg-danger-500 hover:bg-danger-600 text-white shadow-lg transform hover:scale-105 active:scale-95',
        outline: 'bg-transparent border border-primary-500/30 text-primary-400 hover:bg-primary-500/10 hover:border-primary-500/50',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
        md: 'px-5 py-2.5 text-base rounded-xl gap-2',
        lg: 'px-7 py-3.5 text-lg rounded-xl gap-2.5',
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <>
                    {Icon && iconPosition === 'left' && <Icon className="w-5 h-5" />}
                    {children}
                    {Icon && iconPosition === 'right' && <Icon className="w-5 h-5" />}
                </>
            )}
        </button>
    );
};
