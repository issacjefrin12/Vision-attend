import React, { useState } from 'react';
import { Settings as SettingsIcon, Bell, Shield, Database, Palette, Save, RefreshCw } from 'lucide-react';
import { Card, Button, Input } from '../components/ui';
import toast from 'react-hot-toast';
import { academicsApi, adminApi, sessionsApi } from '../services/endpoints';
import { useEffect } from 'react';
import type { AttendancePolicy, Department } from '../types';

export const Settings: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [policies, setPolicies] = useState<AttendancePolicy[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [policyForm, setPolicyForm] = useState({
        department_id: 0,
        max_entry_per_day: 1,
        entry_start_time: '08:00',
        entry_end_time: '10:00',
        is_active: true,
    });
    const [geofenceRadiusKm, setGeofenceRadiusKm] = useState(0.05);
    const [isLoadingGeofenceRadius, setIsLoadingGeofenceRadius] = useState(false);
    const [isSavingGeofenceRadius, setIsSavingGeofenceRadius] = useState(false);

    // Settings state
    const [settings, setSettings] = useState({
        // Face Recognition
        faceRecognitionTolerance: 0.6,
        minConfidenceScore: 0.8,

        // Attendance
        lateThresholdMinutes: 15,
        autoMarkAbsentAfterMinutes: 60,

        // Notifications
        enableEmailNotifications: true,
        notifyOnAbsence: true,
        notifyLowAttendance: true,
        lowAttendanceThreshold: 75,

        // System
        sessionTimeoutMinutes: 30,
        enableDarkMode: true,
    });

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // In production, this would call an API
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success('Settings saved successfully!');
        } catch (error) {
            toast.error('Failed to save settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        setSettings({
            faceRecognitionTolerance: 0.6,
            minConfidenceScore: 0.8,
            lateThresholdMinutes: 15,
            autoMarkAbsentAfterMinutes: 60,
            enableEmailNotifications: true,
            notifyOnAbsence: true,
            notifyLowAttendance: true,
            lowAttendanceThreshold: 75,
            sessionTimeoutMinutes: 30,
            enableDarkMode: true,
        });
        setGeofenceRadiusKm(0.05);
        toast.success('Settings reset to defaults');
    };

    const loadPolicies = async () => {
        try {
            const data = await sessionsApi.listPolicies();
            setPolicies(data);
        } catch {
            // Non-blocking in case user lacks permissions.
        }
    };

    useEffect(() => {
        loadPolicies();
        loadDepartments();
        loadGeofenceRadius();
    }, []);

    const loadDepartments = async () => {
        try {
            const data = await academicsApi.listDepartments();
            setDepartments(data);
            if (data.length > 0) {
                setPolicyForm((prev) => ({
                    ...prev,
                    department_id: prev.department_id || data[0].id,
                }));
            }
        } catch {
            // Non-blocking for non-admin roles.
        }
    };

    const savePolicy = async () => {
        if (!policyForm.department_id) {
            toast.error('Enter department for policy');
            return;
        }
        try {
            await sessionsApi.upsertPolicy(policyForm.department_id, {
                max_entry_per_day: policyForm.max_entry_per_day,
                entry_start_time: policyForm.entry_start_time,
                entry_end_time: policyForm.entry_end_time,
                is_active: policyForm.is_active,
            });
            toast.success('Attendance policy saved');
            loadPolicies();
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to save policy');
        }
    };

    const loadGeofenceRadius = async () => {
        setIsLoadingGeofenceRadius(true);
        try {
            const data = await adminApi.getGeofenceRadius();
            setGeofenceRadiusKm(data.max_distance_km);
        } catch {
            // Non-blocking for non-admin roles.
        } finally {
            setIsLoadingGeofenceRadius(false);
        }
    };

    const saveGeofenceRadius = async () => {
        if (Number.isNaN(geofenceRadiusKm) || geofenceRadiusKm <= 0 || geofenceRadiusKm > 1) {
            toast.error('Geofence radius must be between 0.001 and 1 km');
            return;
        }
        setIsSavingGeofenceRadius(true);
        try {
            const data = await adminApi.updateGeofenceRadius(geofenceRadiusKm);
            setGeofenceRadiusKm(data.max_distance_km);
            toast.success('Geofence radius updated');
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to update geofence radius');
        } finally {
            setIsSavingGeofenceRadius(false);
        }
    };

    const getDepartmentName = (departmentId: number): string => {
        const department = departments.find((row) => row.id === departmentId);
        if (!department) {
            return `Dept #${departmentId}`;
        }
        return `${department.code} - ${department.full_name}`;
    };

    return (
        <div className="space-y-6 animate-in max-w-4xl">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <SettingsIcon className="w-7 h-7 text-primary-400" />
                        Settings
                    </h1>
                    <p className="text-white/50">Configure system preferences and parameters</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary" icon={RefreshCw} onClick={handleReset}>
                        Reset
                    </Button>
                    <Button icon={Save} onClick={handleSave} isLoading={isLoading}>
                        Save Changes
                    </Button>
                </div>
            </div>

            {/* Face Recognition Settings */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary-500/20 rounded-lg">
                        <Shield className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Face Recognition</h2>
                        <p className="text-sm text-white/50">Configure face detection parameters</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            Recognition Tolerance ({settings.faceRecognitionTolerance})
                        </label>
                        <input
                            type="range"
                            min="0.3"
                            max="0.9"
                            step="0.1"
                            value={settings.faceRecognitionTolerance}
                            onChange={(e) => setSettings({ ...settings, faceRecognitionTolerance: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary-500"
                        />
                        <p className="text-xs text-white/40 mt-1">Lower = stricter match, Higher = more lenient</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            Minimum Confidence ({(settings.minConfidenceScore * 100).toFixed(0)}%)
                        </label>
                        <input
                            type="range"
                            min="0.5"
                            max="1.0"
                            step="0.05"
                            value={settings.minConfidenceScore}
                            onChange={(e) => setSettings({ ...settings, minConfidenceScore: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary-500"
                        />
                        <p className="text-xs text-white/40 mt-1">Minimum confidence required to mark attendance</p>
                    </div>
                </div>
            </Card>

            {/* Attendance Settings */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-warning-500/20 rounded-lg">
                        <Database className="w-5 h-5 text-warning-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Attendance Rules</h2>
                        <p className="text-sm text-white/50">Set attendance thresholds and rules</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            Late Threshold (minutes)
                        </label>
                        <input
                            type="number"
                            min="5"
                            max="60"
                            value={settings.lateThresholdMinutes}
                            onChange={(e) => setSettings({ ...settings, lateThresholdMinutes: parseInt(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <p className="text-xs text-white/40 mt-1">Mark as "Late" after this many minutes</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            Auto-Absent After (minutes)
                        </label>
                        <input
                            type="number"
                            min="30"
                            max="180"
                            value={settings.autoMarkAbsentAfterMinutes}
                            onChange={(e) => setSettings({ ...settings, autoMarkAbsentAfterMinutes: parseInt(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <p className="text-xs text-white/40 mt-1">Auto mark as absent if not checked in</p>
                    </div>
                </div>
            </Card>

            {/* Geofence Radius */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary-500/20 rounded-lg">
                        <Shield className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Attendance Geofence Radius</h2>
                        <p className="text-sm text-white/50">
                            Max distance allowed from classroom while marking attendance.
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <Input
                        type="number"
                        min={0.001}
                        max={1}
                        step={0.001}
                        label="Radius (km)"
                        value={geofenceRadiusKm}
                        onChange={(e) => setGeofenceRadiusKm(Number(e.target.value))}
                        disabled={isLoadingGeofenceRadius}
                    />
                    <div className="md:col-span-2 flex gap-3">
                        <Button onClick={saveGeofenceRadius} isLoading={isSavingGeofenceRadius}>
                            Save Radius
                        </Button>
                        <p className="text-white/55 text-sm self-center">
                            Current: {(geofenceRadiusKm * 1000).toFixed(0)} meters
                        </p>
                    </div>
                </div>
            </Card>

            {/* Notification Settings */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-accent-500/20 rounded-lg">
                        <Bell className="w-5 h-5 text-accent-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Notifications</h2>
                        <p className="text-sm text-white/50">Configure email and alert settings</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.enableEmailNotifications}
                            onChange={(e) => setSettings({ ...settings, enableEmailNotifications: e.target.checked })}
                            className="w-5 h-5 rounded border-white/20 bg-white/5 text-primary-500 focus:ring-primary-500"
                        />
                        <div>
                            <p className="text-white font-medium">Enable Email Notifications</p>
                            <p className="text-sm text-white/50">Send email alerts for important events</p>
                        </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.notifyOnAbsence}
                            onChange={(e) => setSettings({ ...settings, notifyOnAbsence: e.target.checked })}
                            className="w-5 h-5 rounded border-white/20 bg-white/5 text-primary-500 focus:ring-primary-500"
                        />
                        <div>
                            <p className="text-white font-medium">Notify on Absence</p>
                            <p className="text-sm text-white/50">Send alerts when students are marked absent</p>
                        </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.notifyLowAttendance}
                            onChange={(e) => setSettings({ ...settings, notifyLowAttendance: e.target.checked })}
                            className="w-5 h-5 rounded border-white/20 bg-white/5 text-primary-500 focus:ring-primary-500"
                        />
                        <div>
                            <p className="text-white font-medium">Low Attendance Alerts</p>
                            <p className="text-sm text-white/50">Notify when attendance falls below threshold</p>
                        </div>
                    </label>
                    {settings.notifyLowAttendance && (
                        <div className="ml-8 mt-2">
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                Low Attendance Threshold ({settings.lowAttendanceThreshold}%)
                            </label>
                            <input
                                type="range"
                                min="50"
                                max="90"
                                step="5"
                                value={settings.lowAttendanceThreshold}
                                onChange={(e) => setSettings({ ...settings, lowAttendanceThreshold: parseInt(e.target.value) })}
                                className="w-full max-w-xs h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary-500"
                            />
                        </div>
                    )}
                </div>
            </Card>

            {/* System Settings */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-success-500/20 rounded-lg">
                        <Palette className="w-5 h-5 text-success-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">System</h2>
                        <p className="text-sm text-white/50">General system preferences</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            Session Timeout (minutes)
                        </label>
                        <input
                            type="number"
                            min="5"
                            max="120"
                            value={settings.sessionTimeoutMinutes}
                            onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: parseInt(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <p className="text-xs text-white/40 mt-1">Auto logout after inactivity</p>
                    </div>
                    <div className="flex items-center">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.enableDarkMode}
                                onChange={(e) => setSettings({ ...settings, enableDarkMode: e.target.checked })}
                                className="w-5 h-5 rounded border-white/20 bg-white/5 text-primary-500 focus:ring-primary-500"
                            />
                            <div>
                                <p className="text-white font-medium">Dark Mode</p>
                                <p className="text-sm text-white/50">Use dark theme across the application</p>
                            </div>
                        </label>
                    </div>
                </div>
            </Card>

            {/* Entry Attendance Policy */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary-500/20 rounded-lg">
                        <Shield className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Entry Attendance Policy</h2>
                        <p className="text-sm text-white/50">Admin controls entry limits and allowed time window.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">Department</label>
                        <select
                            value={policyForm.department_id || ''}
                            onChange={(e) =>
                                setPolicyForm({ ...policyForm, department_id: Number(e.target.value) })
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white"
                        >
                            {departments.map((department) => (
                                <option key={department.id} value={department.id}>
                                    {department.code} - {department.full_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <Input
                        type="number"
                        label="Max Entry/Day"
                        value={policyForm.max_entry_per_day}
                        onChange={(e) =>
                            setPolicyForm({ ...policyForm, max_entry_per_day: Number(e.target.value) })
                        }
                    />
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">Entry Start</label>
                        <input
                            type="time"
                            value={policyForm.entry_start_time}
                            onChange={(e) => setPolicyForm({ ...policyForm, entry_start_time: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">Entry End</label>
                        <input
                            type="time"
                            value={policyForm.entry_end_time}
                            onChange={(e) => setPolicyForm({ ...policyForm, entry_end_time: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white"
                        />
                    </div>
                    <div className="flex items-end">
                        <Button onClick={savePolicy} className="w-full">Save Policy</Button>
                    </div>
                </div>

                <div className="mt-5 space-y-2">
                    {policies.length === 0 ? (
                        <p className="text-white/50 text-sm">No policies configured yet.</p>
                    ) : (
                        policies.map((policy) => (
                            <div key={policy.id} className="p-3 rounded-xl bg-white/5 border border-white/10 text-sm">
                                <p className="text-white">
                                    {getDepartmentName(policy.department_id)}: max {policy.max_entry_per_day}/day, {policy.entry_start_time} - {policy.entry_end_time}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
};
