import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'glass' | 'stat';
    glowOnHover?: boolean;
}

export const Card: React.FC<CardProps> = ({
    variant = 'default',
    glowOnHover = false,
    className = '',
    children,
    ...props
}) => {
    const baseStyles = 'rounded-2xl transition-all duration-300';

    const variants = {
        default: 'bg-dark-900/70 backdrop-blur-sm border border-primary-500/10',
        glass: 'bg-dark-900/50 backdrop-blur-xl border border-primary-500/15',
        stat: 'bg-dark-900/70 backdrop-blur-sm border border-primary-500/10 hover:border-primary-500/30',
    };

    const hoverStyles = glowOnHover ? 'hover:shadow-glow hover:border-primary-500/30' : '';

    return (
        <div
            className={`${baseStyles} ${variants[variant]} ${hoverStyles} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};
