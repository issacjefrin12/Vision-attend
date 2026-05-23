import React from 'react';

interface BadgeProps {
    variant: 'present' | 'late' | 'absent' | 'default' | 'primary';
    children: React.ReactNode;
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant, children, className = '' }) => {
    const variants = {
        present: 'bg-success-500/20 text-success-400 border-success-500/30',
        late: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
        absent: 'bg-danger-500/20 text-danger-400 border-danger-500/30',
        default: 'bg-dark-800/50 text-white/60 border-dark-600/30',
        primary: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
    };

    return (
        <span className={`
            inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border
            ${variants[variant]}
            ${className}
        `}>
            {children}
        </span>
    );
};
