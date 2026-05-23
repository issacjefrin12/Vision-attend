import React, { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle, Clock, AlertTriangle, Calendar, TrendingUp, Briefcase } from 'lucide-react';
import { Card, Badge } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import { attendanceApi } from '../services/endpoints';
import toast from 'react-hot-toast';

interface AttendanceRecord {
    id: number;
    course_name: string;
    course_code: string;
    date: string;
    status: 'present' | 'late' | 'absent';
    check_in_time?: string;
}

interface AttendanceStats {
    attendance_percentage: number;
    total_working_days: number;
    present_count: number;
    late_count: number;
    absent_count: number;
    total_classes: number;
}

export const MyAttendance: React.FC = () => {
    const { user } = useAuthStore();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [stats, setStats] = useState<AttendanceStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    useEffect(() => {
        loadAttendanceData();
    }, [selectedMonth]);

    const loadAttendanceData = async () => {
        setIsLoading(true);
        try {
            const [statsData, historyData] = await Promise.all([
                attendanceApi.getMyStats(selectedMonth),
                attendanceApi.getMyHistory(selectedMonth, 50)
            ]);

            setStats(statsData);
            setRecords(historyData.map(r => ({
                ...r,
                status: r.status as 'present' | 'late' | 'absent'
            })));
        } catch (error) {
            toast.error('Failed to load attendance data');
            console.error('Error loading attendance:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const attendanceRate = stats?.attendance_percentage || 0;

    return (
        <div className="space-y-6 animate-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ClipboardList className="w-7 h-7 text-primary-400" />
                        My Attendance
                    </h1>
                    <p className="text-white/50">View your attendance records and statistics</p>
                </div>
                <div className="flex items-center gap-4">
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-primary-500/20 rounded-xl">
                        <TrendingUp className="w-6 h-6 text-primary-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">{attendanceRate.toFixed(1)}%</p>
                        <p className="text-sm text-white/50">Attendance Rate</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-success-500/20 rounded-xl">
                        <CheckCircle className="w-6 h-6 text-success-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">{stats?.present_count || 0}</p>
                        <p className="text-sm text-white/50">Present</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-warning-500/20 rounded-xl">
                        <Clock className="w-6 h-6 text-warning-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">{stats?.late_count || 0}</p>
                        <p className="text-sm text-white/50">Late</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-danger-500/20 rounded-xl">
                        <AlertTriangle className="w-6 h-6 text-danger-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">{stats?.absent_count || 0}</p>
                        <p className="text-sm text-white/50">Absent</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-xl">
                        <Briefcase className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">{stats?.total_working_days || 0}</p>
                        <p className="text-sm text-white/50">Working Days</p>
                    </div>
                </Card>
            </div>

            {/* Attendance Records */}
            <Card className="overflow-hidden">
                <div className="p-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white">Recent Records</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-white/5 text-white/70 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 text-left">Date</th>
                                <th className="px-6 py-4 text-left">Course</th>
                                <th className="px-6 py-4 text-left">Check-in Time</th>
                                <th className="px-6 py-4 text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                [...Array(4)].map((_, i) => (
                                    <tr key={i} className="border-b border-white/5">
                                        <td colSpan={4} className="p-4">
                                            <div className="h-10 bg-white/5 rounded animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12">
                                        <Calendar className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                        <p className="text-white/50">No attendance records found</p>
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <tr key={record.id} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="px-6 py-4 text-white">{record.date}</td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="text-white font-medium">{record.course_name}</p>
                                                <p className="text-sm text-white/50">{record.course_code}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-white/70">
                                            {record.check_in_time || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant={record.status}>
                                                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
