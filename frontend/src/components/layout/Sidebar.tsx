import React, { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Camera,
    BarChart3,
    Settings,
    LogOut,
    GraduationCap,
    BookOpen,
    ClipboardList,
    User,
    UserCog,
    Building2,
    ShieldCheck,
    CalendarRange,
    CalendarDays,
    KeyRound,
    Upload,
    MapPin,
    ChevronDown,
    type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

interface NavLinkItem {
    type: 'link';
    icon: LucideIcon;
    label: string;
    path: string;
}

interface NavGroupItem {
    type: 'group';
    icon: LucideIcon;
    label: string;
    key: string;
    children: NavLinkItem[];
}

type NavItem = NavLinkItem | NavGroupItem;

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        upload: true,
    });

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const adminNavItems: NavItem[] = useMemo(
        () => [
            { type: 'link', icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
            { type: 'link', icon: CalendarDays, label: 'Timetable', path: '/timetable' },
            { type: 'link', icon: Camera, label: 'Attendance', path: '/attendance' },
            { type: 'link', icon: BarChart3, label: 'Reports', path: '/analytics' },
            { type: 'link', icon: Users, label: 'Students', path: '/students' },
            { type: 'link', icon: Users, label: 'Faculty', path: '/users?role=faculty' },
            { type: 'link', icon: Building2, label: 'Class Setup', path: '/class-setup' },
            { type: 'link', icon: MapPin, label: 'Class Location', path: '/class-location' },
            { type: 'link', icon: BookOpen, label: 'Courses', path: '/courses' },
            {
                type: 'group',
                icon: Upload,
                label: 'Upload',
                key: 'upload',
                children: [
                    { type: 'link', icon: Building2, label: 'Upload Departments', path: '/upload-departments' },
                    { type: 'link', icon: Building2, label: 'Upload Classes', path: '/upload-classes' },
                    { type: 'link', icon: Users, label: 'Upload Faculty', path: '/upload-faculty' },
                    { type: 'link', icon: BookOpen, label: 'Upload Courses', path: '/upload-courses' },
                    { type: 'link', icon: Users, label: 'Upload Students', path: '/upload-students' },
                    { type: 'link', icon: CalendarRange, label: 'Upload Timetable', path: '/upload-timetable' },
                ],
            },
            { type: 'link', icon: UserCog, label: 'User Management', path: '/users' },
            { type: 'link', icon: Settings, label: 'Settings', path: '/settings' },
        ],
        []
    );

    const facultyNavItems: NavItem[] = [
        { type: 'link', icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { type: 'link', icon: CalendarDays, label: 'My Timetable', path: '/timetable' },
        { type: 'link', icon: Camera, label: 'Attendance', path: '/attendance' },
        { type: 'link', icon: BookOpen, label: 'My Courses', path: '/courses' },
        { type: 'link', icon: BarChart3, label: 'Reports', path: '/analytics' },
        { type: 'link', icon: ShieldCheck, label: 'Leave Approval', path: '/leave-approvals' },
        { type: 'link', icon: User, label: 'Profile', path: '/profile' },
    ];

    const studentNavItems: NavItem[] = [
        { type: 'link', icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { type: 'link', icon: CalendarDays, label: 'Timetable', path: '/timetable' },
        { type: 'link', icon: ClipboardList, label: 'Attendance', path: '/my-attendance' },
        { type: 'link', icon: KeyRound, label: 'Mark Session', path: '/mark-session' },
        { type: 'link', icon: BookOpen, label: 'Subjects', path: '/my-courses' },
        { type: 'link', icon: CalendarRange, label: 'Leave Requests', path: '/leave-requests' },
        { type: 'link', icon: User, label: 'Profile', path: '/profile' },
    ];

    const navItems = useMemo(() => {
        switch (user?.role) {
            case 'admin':
                return adminNavItems;
            case 'faculty':
                return facultyNavItems;
            case 'student':
                return studentNavItems;
            default:
                return [];
        }
    }, [user?.role, adminNavItems]);

    const toggleGroup = (key: string) => {
        setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const renderLink = (item: NavLinkItem, isChild = false) => (
        <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) => `
                flex items-center gap-3 rounded-xl transition-all duration-200
                ${isChild ? 'px-4 py-2.5 ml-8 text-sm' : 'px-4 py-3'}
                ${isActive
                    ? 'text-white bg-primary-500/20 border-l-4 border-primary-500'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }
            `}
        >
            <item.icon className={isChild ? 'w-4 h-4' : 'w-5 h-5'} />
            <span className="font-medium">{item.label}</span>
        </NavLink>
    );

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside className={`
                fixed top-0 left-0 z-50 h-full w-72 flex flex-col
                bg-dark-950/95 backdrop-blur-xl border-r border-primary-500/10
                transform transition-transform duration-300 ease-in-out
                lg:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-6 border-b border-primary-500/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center border border-primary-500/30">
                            <GraduationCap className="w-6 h-6 text-primary-300" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">
                                <span className="text-primary-400">Vision</span>
                                <span className="text-white">Attend</span>
                            </h1>
                            <p className="text-xs text-white/40">Smart Attendance Tracking System</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
                    <p className="text-xs text-white/30 uppercase tracking-wider px-4 mb-3">
                        {user?.role === 'student' ? 'Student Menu' : 'Main Menu'}
                    </p>

                    {navItems.map((item) => {
                        if (item.type === 'link') {
                            return renderLink(item);
                        }

                        const isGroupActive = item.children.some((child) =>
                            location.pathname === child.path || location.pathname.startsWith(`${child.path}/`)
                        );
                        const isGroupOpen = openGroups[item.key] ?? false;

                        return (
                            <div key={item.key} className="space-y-1">
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(item.key)}
                                    className={`
                                        w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl
                                        transition-all duration-200
                                        ${isGroupActive
                                            ? 'text-white bg-primary-500/20 border-l-4 border-primary-500'
                                            : 'text-white/50 hover:text-white hover:bg-white/5'
                                        }
                                    `}
                                >
                                    <span className="flex items-center gap-3">
                                        <item.icon className="w-5 h-5" />
                                        <span className="font-medium">{item.label}</span>
                                    </span>
                                    <ChevronDown className={`w-4 h-4 transition-transform ${isGroupOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isGroupOpen ? item.children.map((child) => renderLink(child, true)) : null}
                            </div>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-primary-500/10">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-dark-900/50">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center overflow-hidden">
                            {user?.profile_image_url ? (
                                <img src={user.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-white font-semibold">
                                    {(user?.full_name?.charAt(0) || 'U').toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
                            <p className="text-xs text-primary-400/70 capitalize">{user?.role}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
};
