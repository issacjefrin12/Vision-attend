import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, Search, UserCircle2, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { notificationsApi } from '../../services/endpoints';

interface HeaderProps {
    onMenuClick: () => void;
    title?: string;
}

interface SearchResult {
    label: string;
    path: string;
    category: string;
}

const SEARCH_OPTIONS: SearchResult[] = [
    { label: 'Dashboard', path: '/dashboard', category: 'General' },
    { label: 'Attendance', path: '/attendance', category: 'Faculty/Admin' },
    { label: 'Timetable', path: '/timetable', category: 'General' },
    { label: 'My Attendance', path: '/my-attendance', category: 'Student' },
    { label: 'Mark Session', path: '/mark-session', category: 'Student' },
    { label: 'Leave Requests', path: '/leave-requests', category: 'Student' },
    { label: 'Reports', path: '/analytics', category: 'Faculty/Admin' },
    { label: 'Students', path: '/students', category: 'Admin' },
    { label: 'Faculty', path: '/users?role=faculty', category: 'Admin' },
    { label: 'Class Setup', path: '/courses', category: 'Admin/Faculty' },
    { label: 'User Management', path: '/users', category: 'Admin' },
    { label: 'Settings', path: '/settings', category: 'Admin' },
    { label: 'Leave Approval', path: '/leave-approvals', category: 'Faculty/Admin' },
    { label: 'Profile', path: '/profile', category: 'General' },
];

export const Header: React.FC<HeaderProps> = ({ onMenuClick, title }) => {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const searchRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredResults([]);
            return;
        }

        const query = searchQuery.toLowerCase();
        setFilteredResults(
            SEARCH_OPTIONS.filter((option) => option.label.toLowerCase().includes(query))
        );
    }, [searchQuery]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (searchRef.current && !searchRef.current.contains(target)) {
                setIsSearchOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(target)) {
                setIsProfileOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const loadUnread = async () => {
            try {
                const data = await notificationsApi.getMy({ unread_only: true, limit: 200 });
                setUnreadCount(Array.isArray(data) ? data.length : 0);
            } catch {
                setUnreadCount(0);
            }
        };
        loadUnread();
    }, []);

    const handleSelect = (path: string) => {
        navigate(path);
        setSearchQuery('');
        setIsSearchOpen(false);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="sticky top-0 z-30 h-16 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
            <div className="h-full px-4 lg:px-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    {title ? <h1 className="text-xl font-semibold text-white hidden sm:block">{title}</h1> : null}
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative hidden md:block" ref={searchRef}>
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
                            <Search className="w-4 h-4 text-white/40" />
                            <input
                                type="text"
                                placeholder="Search pages..."
                                value={searchQuery}
                                onChange={(event) => {
                                    setSearchQuery(event.target.value);
                                    setIsSearchOpen(true);
                                }}
                                onFocus={() => setIsSearchOpen(true)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && filteredResults.length > 0) {
                                        handleSelect(filteredResults[0].path);
                                    }
                                    if (event.key === 'Escape') {
                                        setSearchQuery('');
                                        setIsSearchOpen(false);
                                    }
                                }}
                                className="bg-transparent text-white placeholder-white/40 text-sm focus:outline-none w-52"
                            />
                            {searchQuery ? (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setFilteredResults([]);
                                    }}
                                    className="text-white/40 hover:text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            ) : null}
                        </div>

                        {isSearchOpen && (filteredResults.length > 0 || searchQuery) ? (
                            <div className="absolute top-full mt-2 w-80 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                                {filteredResults.length === 0 ? (
                                    <div className="px-4 py-3 text-white/50 text-sm">
                                        No pages found for &quot;{searchQuery}&quot;
                                    </div>
                                ) : (
                                    filteredResults.map((result, index) => (
                                        <button
                                            key={result.path}
                                            onClick={() => handleSelect(result.path)}
                                            className={`w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex justify-between items-center ${index === 0 ? 'bg-white/5' : ''
                                                }`}
                                        >
                                            <span className="text-white">{result.label}</span>
                                            <span className="text-xs text-white/40">{result.category}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        ) : null}
                    </div>

                    <button className="relative p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 ? (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger-500 text-white text-[10px] leading-4 text-center">
                                {unreadCount}
                            </span>
                        ) : null}
                    </button>

                    <div className="relative" ref={profileRef}>
                        <button
                            onClick={() => setIsProfileOpen((open) => !open)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-primary-500/20 border border-primary-400/30 flex items-center justify-center overflow-hidden">
                                {user?.profile_image_url ? (
                                    <img src={user.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-primary-200 text-sm font-semibold">
                                        {(user?.full_name?.charAt(0) || 'U').toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div className="hidden sm:block text-left">
                                <p className="text-sm text-white leading-none">{user?.full_name || 'User'}</p>
                                <p className="text-[11px] text-white/50 capitalize">{user?.role}</p>
                            </div>
                            <ChevronDown className="w-4 h-4 text-white/60" />
                        </button>

                        {isProfileOpen ? (
                            <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                                <button
                                    onClick={() => {
                                        navigate('/profile');
                                        setIsProfileOpen(false);
                                    }}
                                    className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                                >
                                    <UserCircle2 className="w-4 h-4" />
                                    Profile
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-full px-4 py-3 text-left text-danger-300 hover:bg-danger-500/10 transition-colors flex items-center gap-2"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Logout
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </header>
    );
};
