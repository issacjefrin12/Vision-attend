import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, GraduationCap, Sparkles, X, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Button, Input } from '../components/ui';
import { requestPasswordReset } from '../services/api';
import toast from 'react-hot-toast';

// Forgot Password Modal Component
const ForgotPasswordModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await requestPasswordReset(email);
            setIsSuccess(true);
            toast.success('Reset link sent! Check your email or console.');
        } catch (err) {
            toast.error('Failed to send reset link');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setEmail('');
        setIsSuccess(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-card p-8 max-w-md w-full animate-in relative">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-white/50 hover:text-white"
                >
                    <X className="w-5 h-5" />
                </button>

                {!isSuccess ? (
                    <>
                        <h2 className="text-2xl font-bold text-white mb-2">Forgot Password</h2>
                        <p className="text-white/50 mb-6">
                            Enter your email and we'll send you a link to reset your password.
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <Input
                                type="email"
                                label="Email"
                                placeholder="you@example.com"
                                icon={Mail}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />

                            <Button type="submit" isLoading={isLoading} className="w-full">
                                Send Reset Link
                            </Button>
                        </form>

                        <button
                            onClick={handleClose}
                            className="mt-4 w-full text-center text-white/50 hover:text-white flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Login
                        </button>
                    </>
                ) : (
                    <div className="text-center py-4">
                        <div className="w-16 h-16 bg-success-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Mail className="w-8 h-8 text-success-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
                        <p className="text-white/50 mb-6">
                            If <span className="text-primary-400">{email}</span> is registered,
                            you'll receive a password reset link.
                        </p>
                        <p className="text-white/40 text-sm mb-6">
                            💡 For local testing, check the backend console for the reset link.
                        </p>
                        <Button onClick={handleClose} className="w-full">
                            Back to Login
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuthStore();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showForgotModal, setShowForgotModal] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(email, password);
            toast.success('Welcome back!');
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Invalid email or password');
            toast.error('Login failed');
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
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 mb-4 shadow-glow-lg animate-float">
                        <GraduationCap className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Vision <span className="gradient-text">Attend</span>
                    </h1>
                    <p className="text-white/50 flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Smart Attendance Tracking System
                    </p>
                </div>

                {/* Login Card */}
                <div className="glass-card p-8 animate-in">
                    <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
                    <p className="text-white/50 mb-6">Sign in to your account to continue</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-4 bg-danger-500/20 border border-danger-500/30 rounded-xl text-danger-400 text-sm">
                                {error}
                            </div>
                        )}

                        <Input
                            type="email"
                            label="Email"
                            placeholder="you@example.com"
                            icon={Mail}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />

                        <div className="relative">
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                label="Password"
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

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 text-white/60">
                                <input type="checkbox" className="rounded border-white/20 bg-white/10 text-primary-500" />
                                Remember me
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowForgotModal(true)}
                                className="text-primary-400 hover:text-primary-300"
                            >
                                Forgot password?
                            </button>
                        </div>

                        <Button type="submit" isLoading={isLoading} className="w-full">
                            Sign In
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm text-white/50">
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-white/30 text-sm mt-8">
                    © 2026 Vision Attend
                </p>
            </div>

            {/* Forgot Password Modal */}
            <ForgotPasswordModal
                isOpen={showForgotModal}
                onClose={() => setShowForgotModal(false)}
            />
        </div>
    );
};
