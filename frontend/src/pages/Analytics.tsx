import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Calendar, Download, RefreshCw } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { AttendanceTrendChart, AttendanceBarChart, AttendancePieChart } from '../components/charts';
import { analyticsApi, attendanceApi } from '../services/endpoints';
import type { DailyTrend, AttendanceStats, FacultyWorkloadRow } from '../types';
import toast from 'react-hot-toast';

export const Analytics: React.FC = () => {
    const [trends, setTrends] = useState<DailyTrend[]>([]);
    const [stats, setStats] = useState<AttendanceStats | null>(null);
    const [departmentStats, setDepartmentStats] = useState<any[]>([]);
    const [facultyWorkload, setFacultyWorkload] = useState<FacultyWorkloadRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDays, setSelectedDays] = useState(7);
    const [selectedCourse] = useState(1);

    useEffect(() => {
        loadAnalytics();
    }, [selectedDays]);

    const loadAnalytics = async () => {
        setIsLoading(true);
        try {
            const [trendsData, statsData, deptData] = await Promise.all([
                analyticsApi.getTrends(selectedCourse, selectedDays),
                attendanceApi.getCourseStats(selectedCourse),
                analyticsApi.getDepartmentStats(),
            ]);
            setTrends(trendsData);
            setStats(statsData);
            setDepartmentStats(deptData);
            try {
                const workload = await analyticsApi.getFacultyWorkload();
                setFacultyWorkload(workload);
            } catch {
                setFacultyWorkload([]);
            }
        } catch (error) {
            toast.error('Failed to load analytics');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const today = new Date();
            const startDate = new Date(today);
            startDate.setDate(startDate.getDate() - selectedDays);

            const blob = await attendanceApi.exportExcel(
                selectedCourse,
                startDate.toISOString().split('T')[0],
                today.toISOString().split('T')[0]
            );

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance_report_${today.toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success('Report downloaded successfully!');
        } catch (error) {
            toast.error('Failed to export report');
        }
    };

    // Calculate totals
    const totals = trends.reduce(
        (acc, day) => ({
            present: acc.present + day.present,
            late: acc.late + day.late,
            absent: acc.absent + day.absent,
        }),
        { present: 0, late: 0, absent: 0 }
    );

    return (
        <div className="space-y-6 animate-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BarChart3 className="w-7 h-7 text-primary-400" />
                        Analytics
                    </h1>
                    <p className="text-white/50">Visualize and export attendance data</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary" icon={RefreshCw} onClick={loadAnalytics}>
                        Refresh
                    </Button>
                    <Button icon={Download} onClick={handleExport}>
                        Export Excel
                    </Button>
                </div>
            </div>

            {/* Date Range Select */}
            <Card className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <span className="text-white/70 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Time Period:
                    </span>
                    <div className="flex gap-2">
                        {[7, 14, 30].map((days) => (
                            <button
                                key={days}
                                onClick={() => setSelectedDays(days)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedDays === days
                                        ? 'bg-primary-500 text-white'
                                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                                    }`}
                            >
                                {days} Days
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            {isLoading ? (
                <div className="space-y-6 animate-pulse">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-32 bg-white/5 rounded-2xl" />
                        ))}
                    </div>
                    <div className="h-96 bg-white/5 rounded-2xl" />
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-primary-500/20 rounded-lg">
                                    <TrendingUp className="w-5 h-5 text-primary-400" />
                                </div>
                                <span className="text-white/50 text-sm">Average Rate</span>
                            </div>
                            <p className="text-3xl font-bold text-white">
                                {stats ? `${stats.attendance_rate}%` : '-'}
                            </p>
                        </Card>
                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-success-500/20 rounded-lg">
                                    <div className="w-5 h-5 rounded-full bg-success-500" />
                                </div>
                                <span className="text-white/50 text-sm">Total Present</span>
                            </div>
                            <p className="text-3xl font-bold text-success-400">{totals.present}</p>
                        </Card>
                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-warning-500/20 rounded-lg">
                                    <div className="w-5 h-5 rounded-full bg-warning-500" />
                                </div>
                                <span className="text-white/50 text-sm">Total Late</span>
                            </div>
                            <p className="text-3xl font-bold text-warning-400">{totals.late}</p>
                        </Card>
                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-danger-500/20 rounded-lg">
                                    <div className="w-5 h-5 rounded-full bg-danger-500" />
                                </div>
                                <span className="text-white/50 text-sm">Total Absent</span>
                            </div>
                            <p className="text-3xl font-bold text-danger-400">{totals.absent}</p>
                        </Card>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <AttendanceTrendChart data={trends} title={`Attendance Trend (${selectedDays} Days)`} />
                        <AttendanceBarChart data={trends} title="Daily Breakdown" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <AttendancePieChart
                            present={totals.present}
                            late={totals.late}
                            absent={totals.absent}
                            title="Overall Distribution"
                        />

                        <Card className="p-6 lg:col-span-2">
                            <h3 className="text-lg font-semibold text-white mb-4">Department Overview</h3>
                            <div className="space-y-4">
                                {departmentStats.length === 0 ? (
                                    <p className="text-white/50 text-center py-8">No department data available</p>
                                ) : (
                                    departmentStats.map((dept, index) => (
                                        <div key={index} className="flex items-center gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-white font-medium truncate">{dept.department}</span>
                                                    <span className="text-white/70 text-sm">{dept.average_attendance}%</span>
                                                </div>
                                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${dept.average_attendance}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <span className="text-white/50 text-sm">{dept.total} students</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>

                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Faculty Workload</h3>
                        {facultyWorkload.length === 0 ? (
                            <p className="text-white/50 text-center py-6">No faculty workload data available</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs uppercase tracking-wider text-white/50 border-b border-white/10">
                                            <th className="py-3 pr-4">Faculty</th>
                                            <th className="py-3 pr-4">Email</th>
                                            <th className="py-3 pr-4">Load</th>
                                            <th className="py-3 pr-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {facultyWorkload.map((row) => {
                                            const status = row.class_count === 0 ? 'Free' : row.class_count >= 6 ? 'Overloaded' : 'Active';
                                            const statusClass =
                                                row.class_count === 0
                                                    ? 'text-success-300'
                                                    : row.class_count >= 6
                                                        ? 'text-danger-300'
                                                        : 'text-white/70';
                                            return (
                                                <tr key={row.faculty_id} className="border-b border-white/5">
                                                    <td className="py-3 pr-4 text-white">{row.faculty_name}</td>
                                                    <td className="py-3 pr-4 text-white/60">{row.faculty_email}</td>
                                                    <td className="py-3 pr-4 text-white">{row.class_count}</td>
                                                    <td className={`py-3 pr-4 font-semibold ${statusClass}`}>{status}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </>
            )}
        </div>
    );
};
