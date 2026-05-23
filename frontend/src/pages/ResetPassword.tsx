import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, GraduationCap, CheckCircle, XCircle } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { resetPassword } from '../services/api';
import toast from 'react-hot-toast';

export const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'form' | 'success' | 'error'>('form');

    useEffect(() => {
        if (!token) {
            setStatus('error');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);
        try {
            await resetPassword(token!, password);
            setStatus('success');
            toast.success('Password reset successfully!');
        } catch (err: any) {
            const message = err.response?.data?.detail || 'Failed to reset password';
            toast.error(message);
            if (message.includes('expired') || message.includes('Invalid')) {
                setStatus('error');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
            {/* Background effects */}
            <div className="fixed inset-0 bg-hero-pattern opacity-30" />
            <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-primary-500/30 rounded-full blur-3xl animate-pulse" />
            <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/30 rounded-full blur-3xl animate-pulse" />

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8 animate-in">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 mb-4 shadow-glow-lg">
                        <GraduationCap className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Vision <span className="gradient-text">Attend</span>
                    </h1>
                </div>

                {/* Reset Password Card */}
                <div className="glass-card p-8 animate-in">
                    {status === 'form' && (
                        <>
                            <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>
                            <p className="text-white/50 mb-6">Enter your new password below.</p>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="relative">
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        label="New Password"
                                        placeholder="••••••••"
                                        icon={Lock}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-10 text-white/40 hover:text-white/70 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>

                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    label="Confirm Password"
                                    placeholder="••••••••"
                                    icon={Lock}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />

                                <Button type="submit" isLoading={isLoading} className="w-full">
                                    Reset Password
                                </Button>
                            </form>
                        </>
                    )}

                    {status === 'success' && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-success-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-success-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Password Reset!</h2>
                            <p className="text-white/50 mb-6">
                                Your password has been reset successfully. You can now log in with your new password.
                            </p>
                            <Button onClick={() => navigate('/login')} className="w-full">
                                Go to Login
                            </Button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-danger-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <XCircle className="w-8 h-8 text-danger-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Invalid Link</h2>
                            <p className="text-white/50 mb-6">
                                This password reset link is invalid or has expired. Please request a new one.
                            </p>
                            <Button onClick={() => navigate('/login')} className="w-full">
                                Back to Login
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-white/30 text-sm mt-8">
                    © 2026 Vision Attend
                </p>
            </div>
        </div>
    );
};
