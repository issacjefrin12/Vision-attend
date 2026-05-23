import React, { useEffect, useRef, useState } from 'react';
import { User, Mail, Calendar, Camera, Save, Upload, Trash2 } from 'lucide-react';
import { Card, Button, Input, Badge } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../services/endpoints';
import toast from 'react-hot-toast';

const MAX_PROFILE_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

export const Profile: React.FC = () => {
    const { user, setUser } = useAuthStore();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        full_name: user?.full_name || '',
        email: user?.email || '',
        profile_image_url: user?.profile_image_url || null as string | null,
    });

    useEffect(() => {
        setFormData({
            full_name: user?.full_name || '',
            email: user?.email || '',
            profile_image_url: user?.profile_image_url || null,
        });
    }, [user?.full_name, user?.email, user?.profile_image_url]);

    const getInitial = (name: string | undefined) => name?.charAt(0).toUpperCase() || 'U';

    const handleSave = async () => {
        if (!formData.full_name.trim()) {
            toast.error('Full name is required');
            return;
        }

        setIsSaving(true);
        try {
            const updatedUser = await authApi.updateCurrentUser({
                full_name: formData.full_name.trim(),
                profile_image_url: formData.profile_image_url,
            });
            setUser(updatedUser);
            setIsEditing(false);
            toast.success('Profile updated successfully');
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setFormData({
            full_name: user?.full_name || '',
            email: user?.email || '',
            profile_image_url: user?.profile_image_url || null,
        });
        setIsEditing(false);
    };

    const handlePickImage = () => {
        fileInputRef.current?.click();
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            event.target.value = '';
            return;
        }

        if (file.size > MAX_PROFILE_IMAGE_SIZE_BYTES) {
            toast.error('Image size must be 2MB or less');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setFormData((prev) => ({
                ...prev,
                profile_image_url: typeof reader.result === 'string' ? reader.result : null,
            }));
            setIsEditing(true);
        };
        reader.onerror = () => {
            toast.error('Failed to read selected image');
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const handleRemoveImage = () => {
        setFormData((prev) => ({ ...prev, profile_image_url: null }));
        setIsEditing(true);
    };

    return (
        <div className="space-y-6 animate-in max-w-3xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <User className="w-7 h-7 text-primary-400" />
                        My Profile
                    </h1>
                    <p className="text-white/50">View and manage your profile information</p>
                </div>
            </div>

            <Card className="p-6">
                <div className="flex flex-col sm:flex-row gap-6">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center border border-white/10">
                            {formData.profile_image_url ? (
                                <img
                                    src={formData.profile_image_url}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-5xl font-bold text-white">
                                    {getInitial(user?.full_name)}
                                </span>
                            )}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageChange}
                        />

                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <Button size="sm" variant="secondary" icon={Upload} onClick={handlePickImage}>
                                {formData.profile_image_url ? 'Change Photo' : 'Add Photo'}
                            </Button>
                            {formData.profile_image_url ? (
                                <Button size="sm" variant="danger" icon={Trash2} onClick={handleRemoveImage}>
                                    Remove
                                </Button>
                            ) : null}
                        </div>

                        <Badge variant="default" className="capitalize">{user?.role}</Badge>
                    </div>

                    <div className="flex-1 space-y-4">
                        {isEditing ? (
                            <>
                                <Input
                                    label="Full Name"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    icon={User}
                                />
                                <Input
                                    label="Email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    icon={Mail}
                                    disabled
                                />
                                <div className="flex gap-3 pt-4">
                                    <Button variant="secondary" onClick={handleCancel} disabled={isSaving}>
                                        Cancel
                                    </Button>
                                    <Button icon={Save} onClick={handleSave} isLoading={isSaving}>
                                        Save Changes
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <User className="w-5 h-5 text-white/50" />
                                        <div>
                                            <p className="text-sm text-white/50">Full Name</p>
                                            <p className="text-lg text-white font-medium">{user?.full_name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Mail className="w-5 h-5 text-white/50" />
                                        <div>
                                            <p className="text-sm text-white/50">Email</p>
                                            <p className="text-lg text-white font-medium">{user?.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Calendar className="w-5 h-5 text-white/50" />
                                        <div>
                                            <p className="text-sm text-white/50">Member Since</p>
                                            <p className="text-lg text-white font-medium">
                                                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <Button variant="secondary" icon={Camera} onClick={() => setIsEditing(true)}>
                                        Edit Profile
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </Card>

            <Card className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Account Status</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
                        <div className={`w-3 h-3 rounded-full ${user?.is_active ? 'bg-success-400' : 'bg-danger-400'}`} />
                        <div>
                            <p className="text-sm text-white/50">Account Status</p>
                            <p className="text-white font-medium">{user?.is_active ? 'Active' : 'Inactive'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
                        <div className="w-3 h-3 rounded-full bg-primary-400" />
                        <div>
                            <p className="text-sm text-white/50">Role</p>
                            <p className="text-white font-medium capitalize">{user?.role}</p>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
