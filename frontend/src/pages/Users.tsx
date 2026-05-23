import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserCog, Plus, Trash2, Search, CheckCircle, XCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button, Input, Badge } from '../components/ui';
import { academicsApi, authApi, studentsApi, usersApi } from '../services/endpoints';
import type { AcademicClass, StudentFormData, User, UserFormData } from '../types';
import toast from 'react-hot-toast';

export const Users: React.FC = () => {
    const [searchParams] = useSearchParams();
    const requestedRoleFilter = searchParams.get('role');
    const [users, setUsers] = useState<User[]>([]);
    const [classes, setClasses] = useState<AcademicClass[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
    const [selectionFilter, setSelectionFilter] = useState('');

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

    // Form state
    const [formData, setFormData] = useState<UserFormData>({
        email: '',
        password: '',
        full_name: '',
        role: 'faculty'
    });
    const [studentRegisterNo, setStudentRegisterNo] = useState('');
    const [studentClassId, setStudentClassId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getApiErrorMessage = (error: any, fallback: string): string => {
        const detail = error?.response?.data?.detail;
        if (typeof detail === 'string') return detail;
        if (Array.isArray(detail)) {
            const parsed = detail
                .map((item) => {
                    if (typeof item === 'string') return item;
                    if (item && typeof item === 'object' && typeof item.msg === 'string') return item.msg;
                    return null;
                })
                .filter(Boolean);
            if (parsed.length > 0) return parsed.join(', ');
        }
        if (detail && typeof detail === 'object') return JSON.stringify(detail);
        return fallback;
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setIsLoading(true);
        try {
            const [userRows, classRows] = await Promise.all([
                usersApi.getAll(),
                academicsApi.listClasses(),
            ]);
            setUsers(userRows);
            setClasses(classRows);
            if (classRows.length > 0) {
                setStudentClassId((prev) => prev ?? classRows[0].id);
            }
        } catch (error) {
            toast.error('Failed to load users and classes');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddUser = async () => {
        if (!formData.email.trim() || !formData.password.trim() || !formData.full_name.trim()) {
            toast.error('Please fill in all required fields');
            return;
        }

        if (formData.password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }

        if (formData.role === 'student') {
            if (!studentRegisterNo.trim()) {
                toast.error('Register number is required for student users');
                return;
            }
            if (!studentClassId) {
                toast.error('Class is required for student users');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const newUser = await authApi.register(formData);

            if (formData.role === 'student' && studentClassId) {
                const studentPayload: StudentFormData = {
                    register_no: studentRegisterNo.trim(),
                    student_id: studentRegisterNo.trim(),
                    class_id: studentClassId,
                    full_name: formData.full_name.trim(),
                    email: formData.email.trim(),
                    user_id: newUser.id,
                };

                const existingStudents = await studentsApi.getAll();
                const existingByEmail = existingStudents.find(
                    (student) => student.email.toLowerCase() === formData.email.trim().toLowerCase()
                );

                if (existingByEmail) {
                    await studentsApi.update(existingByEmail.id, studentPayload);
                } else {
                    await studentsApi.create(studentPayload);
                }
            }

            setUsers((prev) => {
                const existingIndex = prev.findIndex((user) => user.id === newUser.id);
                if (existingIndex >= 0) {
                    const next = [...prev];
                    next[existingIndex] = newUser;
                    return next;
                }
                return [newUser, ...prev];
            });
            setShowAddModal(false);
            resetForm();
            toast.success(
                formData.role === 'student'
                    ? 'Student user created and synced to Students section!'
                    : 'User created successfully!'
            );
        } catch (error: any) {
            toast.error(getApiErrorMessage(error, 'Failed to create user'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!confirmDeleteUser) return;

        setDeletingUserId(confirmDeleteUser.id);
        try {
            await usersApi.delete(confirmDeleteUser.id);
            setUsers(prev => prev.filter(u => u.id !== confirmDeleteUser.id));
            toast.success('User deleted successfully!');
            setConfirmDeleteUser(null);
        } catch (error: any) {
            toast.error(getApiErrorMessage(error, 'Failed to delete user'));
        } finally {
            setDeletingUserId(null);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedUserIds.size === 0) {
            setConfirmBulkDelete(false);
            return;
        }

        const idsToDelete = Array.from(selectedUserIds);
        setBulkDeleting(true);
        const failedIds: number[] = [];

        for (const userId of idsToDelete) {
            try {
                await usersApi.delete(userId);
            } catch {
                failedIds.push(userId);
            }
        }

        const successIds = idsToDelete.filter((id) => !failedIds.includes(id));
        if (successIds.length > 0) {
            setUsers((prev) => prev.filter((user) => !successIds.includes(user.id)));
            setSelectedUserIds((prev) => {
                const next = new Set(prev);
                successIds.forEach((id) => next.delete(id));
                return next;
            });
            toast.success(`Deleted ${successIds.length} user${successIds.length === 1 ? '' : 's'}`);
        }

        if (failedIds.length > 0) {
            toast.error(`Failed to delete ${failedIds.length} user${failedIds.length === 1 ? '' : 's'}`);
        }

        setBulkDeleting(false);
        setConfirmBulkDelete(false);
    };

    const resetForm = () => {
        setFormData({ email: '', password: '', full_name: '', role: 'faculty' });
        setStudentRegisterNo('');
        setStudentClassId(classes[0]?.id ?? null);
    };

    const roleFilter = useMemo(() => {
        if (requestedRoleFilter === 'faculty' || requestedRoleFilter === 'student' || requestedRoleFilter === 'admin') {
            return requestedRoleFilter;
        }
        return '';
    }, [requestedRoleFilter]);

    const filteredUsers = users.filter((user) => {
        const searchMatches =
            user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase());
        const roleMatches = !roleFilter || user.role === roleFilter;
        return searchMatches && roleMatches;
    });

    useEffect(() => {
        setSelectedUserIds((prev) => {
            const existingIds = new Set(users.map((user) => user.id));
            const next = new Set<number>();
            prev.forEach((id) => {
                if (existingIds.has(id)) {
                    next.add(id);
                }
            });
            return next;
        });
    }, [users]);

    const toggleUserSelection = (userId: number) => {
        setSelectedUserIds((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) {
                next.delete(userId);
            } else {
                next.add(userId);
            }
            return next;
        });
    };

    const applySelectionFilter = (value: string) => {
        setSelectionFilter(value);
        if (!value) return;

        if (value === 'all') {
            setSelectedUserIds(new Set(filteredUsers.map((user) => user.id)));
            return;
        }

        setSelectedUserIds(
            new Set(
                filteredUsers
                    .filter((user) => user.role === value)
                    .map((user) => user.id)
            )
        );
    };

    const getRoleBadgeVariant = (role: string): 'present' | 'late' | 'absent' | 'default' => {
        switch (role) {
            case 'admin': return 'present';
            case 'faculty': return 'late';
            case 'student': return 'default';
            default: return 'default';
        }
    };

    const deleteModal = confirmDeleteUser && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div className="relative z-10 w-full max-w-md mx-4">
                    <Card className="p-6 border border-danger-500/40">
                        <h2 className="text-xl font-bold text-white mb-4">Delete User</h2>
                        <p className="text-white/70 mb-6">
                            Are you sure you want to delete <span className="text-white font-semibold">{confirmDeleteUser.full_name}</span>?
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                onClick={() => setConfirmDeleteUser(null)}
                                disabled={deletingUserId === confirmDeleteUser.id}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={handleDeleteUser}
                                isLoading={deletingUserId === confirmDeleteUser.id}
                                className="flex-1"
                            >
                                Delete
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>,
            document.body
        )
        : null;
    const bulkDeleteModal = confirmBulkDelete && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div className="relative z-10 w-full max-w-md mx-4">
                    <Card className="p-6 border border-danger-500/40">
                        <h2 className="text-xl font-bold text-white mb-4">Delete Users</h2>
                        <p className="text-white/70 mb-6">
                            Delete <span className="text-white font-semibold">{selectedUserIds.size}</span> selected users?
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                onClick={() => setConfirmBulkDelete(false)}
                                disabled={bulkDeleting}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={handleBulkDelete}
                                isLoading={bulkDeleting}
                                className="flex-1"
                            >
                                Delete Selected
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>,
            document.body
        )
        : null;

    const addUserModal = showAddModal && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
                <div className="relative z-10 w-full max-w-md mx-4">
                    <Card className="p-6">
                        <h2 className="text-xl font-bold text-white mb-6">Add New User</h2>
                        <div className="space-y-4">
                            <Input
                                label="Full Name"
                                placeholder="John Doe"
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            />
                            <Input
                                label="Email"
                                type="email"
                                placeholder="john@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                            <Input
                                label="Password"
                                type="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => {
                                        const nextRole = e.target.value as UserFormData['role'];
                                        setFormData({ ...formData, role: nextRole });
                                        if (nextRole === 'student' && !studentClassId && classes.length > 0) {
                                            setStudentClassId(classes[0].id);
                                        }
                                    }}
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    style={{ colorScheme: 'dark' }}
                                >
                                    <option value="faculty" className="bg-slate-800 text-white">Faculty</option>
                                    <option value="student" className="bg-slate-800 text-white">Student</option>
                                    <option value="admin" className="bg-slate-800 text-white">Admin</option>
                                </select>
                            </div>
                            {formData.role === 'student' && (
                                <>
                                    <Input
                                        label="Register Number"
                                        placeholder="e.g., 23CSE001"
                                        value={studentRegisterNo}
                                        onChange={(e) => setStudentRegisterNo(e.target.value)}
                                    />
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">Class</label>
                                        <select
                                            value={studentClassId ?? ''}
                                            onChange={(e) => setStudentClassId(Number(e.target.value))}
                                            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            style={{ colorScheme: 'dark' }}
                                        >
                                            {classes.map((classRow) => (
                                                <option key={classRow.id} value={classRow.id}>
                                                    {classRow.department_name} - Year {classRow.year} Sec {classRow.section}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}
                            {formData.role === 'faculty' && (
                                <p className="text-xs text-white/50">
                                    Faculty ID is auto-generated after creation. You can see it in the ID column.
                                </p>
                            )}
                        </div>
                        <div className="flex gap-3 mt-6">
                            <Button variant="secondary" onClick={() => { setShowAddModal(false); resetForm(); }} className="flex-1">
                                Cancel
                            </Button>
                            <Button onClick={handleAddUser} isLoading={isSubmitting} className="flex-1">
                                Create User
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>,
            document.body
        )
        : null;

    return (
        <div className="space-y-6 animate-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <UserCog className="w-7 h-7 text-primary-400" />
                        {roleFilter ? `${roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)} Management` : 'User Management'}
                    </h1>
                    <p className="text-white/50">
                        {roleFilter ? `Manage ${roleFilter} users` : 'Manage system users and their roles'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="danger"
                        icon={Trash2}
                        onClick={() => setConfirmBulkDelete(true)}
                        disabled={selectedUserIds.size === 0 || bulkDeleting}
                    >
                        Delete Selected
                    </Button>
                    <Button icon={Plus} onClick={() => setShowAddModal(true)}>
                        Add User
                    </Button>
                </div>
            </div>

            {/* Search */}
            <Card className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="flex-1">
                        <Input
                            placeholder="Search users by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            icon={Search}
                        />
                    </div>
                    <div className="min-w-[200px]">
                        <label className="block text-xs uppercase tracking-wider text-white/50 mb-2">Select</label>
                        <select
                            value={selectionFilter}
                            onChange={(e) => applySelectionFilter(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white"
                        >
                            <option value="">Choose</option>
                            <option value="all">All</option>
                            <option value="faculty">Faculty</option>
                            <option value="student">Student</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* Users Table */}
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-white/5 text-white/70 text-xs uppercase tracking-wider">
                                <th className="px-4 py-4 text-left">Select</th>
                                <th className="px-4 py-4 text-left">ID</th>
                                <th className="px-6 py-4 text-left">User</th>
                                <th className="px-6 py-4 text-left">Email</th>
                                <th className="px-6 py-4 text-left">Role</th>
                                <th className="px-6 py-4 text-left">Status</th>
                                <th className="px-6 py-4 text-left">Created</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="border-b border-white/5">
                                        <td colSpan={8} className="p-4">
                                            <div className="h-12 bg-white/5 rounded animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12">
                                        <UserCog className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                        <p className="text-white/50">
                                            {searchQuery ? 'No users match your search' : 'No users found'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="px-4 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedUserIds.has(user.id)}
                                                onChange={() => toggleUserSelection(user.id)}
                                                disabled={bulkDeleting || deletingUserId === user.id}
                                                className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary-500 focus:ring-primary-500"
                                            />
                                        </td>
                                        <td className="px-4 py-4 text-white/60 font-mono text-sm">{user.id}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                                                    <span className="text-white font-semibold">
                                                        {user.full_name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <span className="text-white font-medium">{user.full_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-white/70">{user.email}</td>
                                        <td className="px-6 py-4">
                                            <Badge variant={getRoleBadgeVariant(user.role)}>
                                                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {user.is_active ? (
                                                    <>
                                                        <CheckCircle className="w-4 h-4 text-success-400" />
                                                        <span className="text-success-400">Active</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <XCircle className="w-4 h-4 text-danger-400" />
                                                        <span className="text-danger-400">Inactive</span>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-white/70">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => setConfirmDeleteUser(user)}
                                                    disabled={bulkDeleting || deletingUserId === user.id}
                                                    className="p-2 text-white/50 hover:text-danger-400 hover:bg-danger-500/10 rounded-lg transition-colors"
                                                    title="Delete user"
                                                >
                                                    {deletingUserId === user.id ? (
                                                        <div className="w-4 h-4 border-2 border-danger-300/30 border-t-danger-300 rounded-full animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
            {addUserModal}

            {deleteModal}
            {bulkDeleteModal}

        </div>
    );
};

