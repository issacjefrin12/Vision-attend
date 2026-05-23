import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Bell,
    BookOpen,
    CalendarDays,
    CheckCircle2,
    Clock3,
    GraduationCap,
    PlayCircle,
    TrendingUp,
    Upload,
    Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { Card, Badge, Button } from '../components/ui';
import { AttendanceTrendChart } from '../components/charts';
import { attendanceApi } from '../services/endpoints';
import { useAuthStore } from '../store/authStore';
import type {
    AdminDashboardData,
    CalendarDayStatus,
    DashboardData,
    FacultyDashboardData,
    StudentDashboardData,
} from '../types';

interface StatTileProps {
    label: string;
    value: string | number;
    subtitle?: string;
}

const StatTile: React.FC<StatTileProps> = ({ label, value, subtitle }) => (
    <Card className="p-4">
        <p className="text-sm text-white/60">{label}</p>
        <p className="text-2xl font-semibold text-white mt-1">{value}</p>
        {subtitle ? <p className="text-xs text-white/45 mt-1">{subtitle}</p> : null}
    </Card>
);

const statusStyles: Record<CalendarDayStatus['status'], string> = {
    present: 'bg-success-500/25 text-success-300 border-success-500/30',
    absent: 'bg-danger-500/25 text-danger-300 border-danger-500/30',
    holiday: 'bg-white/10 text-white/60 border-white/10',
};

const getSubjectTone = (percentage: number) => {
    if (percentage >= 75) {
        return {
            barClass: 'bg-success-400',
            textClass: 'text-success-300',
            marker: '🟢',
        };
    }
    if (percentage >= 60) {
        return {
            barClass: 'bg-warning-400',
            textClass: 'text-warning-300',
            marker: '🟡',
        };
    }
    return {
        barClass: 'bg-danger-400',
        textClass: 'text-danger-300',
        marker: '🔴',
    };
};

const buildCalendarCells = (calendar: CalendarDayStatus[]) => {
    if (calendar.length === 0) {
        return { monthLabel: 'No data', cells: [] as Array<{ day?: number; status?: CalendarDayStatus['status'] }> };
    }

    const firstDate = new Date(`${calendar[0].date}T00:00:00`);
    const year = firstDate.getFullYear();
    const month = firstDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const statusMap = new Map<string, CalendarDayStatus['status']>();
    for (const entry of calendar) {
        statusMap.set(entry.date, entry.status);
    }

    const cells: Array<{ day?: number; status?: CalendarDayStatus['status'] }> = [];
    for (let i = 0; i < firstDayIndex; i += 1) {
        cells.push({});
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const dateKey = new Date(year, month, day).toISOString().slice(0, 10);
        cells.push({
            day,
            status: statusMap.get(dateKey) ?? 'holiday',
        });
    }

    return {
        monthLabel: firstDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        cells,
    };
};

const StudentDashboard: React.FC<{ data: StudentDashboardData }> = ({ data }) => {
    const calendarData = useMemo(() => buildCalendarCells(data.calendar), [data.calendar]);
    const statusBadge =
        data.summary.today_status === 'present'
            ? 'present'
            : data.summary.today_status === 'absent'
                ? 'absent'
                : 'default';

    return (
        <div className="space-y-6 animate-in">
            <Card className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <p className="text-white/60 text-sm">Welcome</p>
                        <h1 className="text-2xl font-bold text-white">{data.profile.name}</h1>
                        <div className="mt-3 flex flex-wrap gap-2 text-sm text-white/70">
                            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10">
                                Register: {data.profile.register_number}
                            </span>
                            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10">
                                {data.profile.department || 'Department not set'}
                            </span>
                            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10">
                                Semester: {data.profile.semester ?? '-'}
                            </span>
                        </div>
                    </div>
                    <div className="text-left lg:text-right">
                        <p className="text-sm text-white/60">Today&apos;s Status</p>
                        <div className="mt-2">
                            <Badge variant={statusBadge}>{data.summary.today_status.toUpperCase()}</Badge>
                        </div>
                    </div>
                </div>
            </Card>

            <Card className="p-6 border-primary-500/25">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                    <div>
                        <p className="text-sm text-white/60">Overall Attendance</p>
                        <p className="text-5xl font-bold text-primary-300">
                            {data.summary.overall_attendance_percentage.toFixed(1)}%
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                        <StatTile label="Total Classes" value={data.summary.total_classes} />
                        <StatTile label="Present" value={data.summary.present_count} />
                        <StatTile label="Late" value={data.summary.late_count} />
                        <StatTile label="Absent" value={data.summary.absent_count} />
                    </div>
                </div>
                {data.summary.shortage_warning ? (
                    <div className="mt-5 p-3 rounded-xl border border-danger-500/30 bg-danger-500/10 flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-danger-300 mt-0.5" />
                        <p className="text-sm text-danger-200">
                            Attendance is below {data.threshold}%. Shortage warning is active.
                        </p>
                    </div>
                ) : null}
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="xl:col-span-2 overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-primary-300" />
                        <h2 className="text-lg font-semibold text-white">Subject-wise Attendance</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-white/60 bg-white/5">
                                    <th className="px-4 py-3">Subject</th>
                                    <th className="px-4 py-3">Total</th>
                                    <th className="px-4 py-3">Attended</th>
                                    <th className="px-4 py-3">%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.subject_attendance.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-white/55">
                                            No subject attendance data yet.
                                        </td>
                                    </tr>
                                ) : (
                                    data.subject_attendance.map((subject) => (
                                        (() => {
                                            const tone = getSubjectTone(subject.attendance_percentage);
                                            return (
                                                <tr key={subject.course_id} className="border-t border-white/10">
                                                    <td className="px-4 py-4">
                                                        <p className="text-white font-medium">{subject.subject}</p>
                                                        <p className="text-xs text-white/50">{subject.subject_code}</p>
                                                    </td>
                                                    <td className="px-4 py-4 text-white/80">{subject.total_classes}</td>
                                                    <td className="px-4 py-4 text-white/80">{subject.attended_classes}</td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-28 h-2 rounded-full bg-white/10 overflow-hidden">
                                                                <div
                                                                    className={`h-full ${tone.barClass}`}
                                                                    style={{ width: `${Math.max(0, Math.min(100, subject.attendance_percentage))}%` }}
                                                                />
                                                            </div>
                                                            <span className={`text-sm font-semibold ${tone.textClass}`}>
                                                                {subject.attendance_percentage.toFixed(1)}% {tone.marker}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })()
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <CalendarDays className="w-5 h-5 text-primary-300" />
                        <h2 className="text-lg font-semibold text-white">Calendar</h2>
                    </div>
                    <p className="text-sm text-white/55 mb-3">{calendarData.monthLabel}</p>
                    <div className="grid grid-cols-7 gap-1 text-[11px] text-white/45 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                            <span key={day} className="text-center">{day}</span>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {calendarData.cells.map((cell, index) => (
                            <div
                                key={`${cell.day || 'empty'}-${index}`}
                                className={`h-8 rounded-md border text-xs flex items-center justify-center ${cell.day ? statusStyles[cell.status || 'holiday'] : 'border-transparent'
                                    }`}
                            >
                                {cell.day || ''}
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-white/60">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success-400" />Present</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger-400" />Absent</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white/40" />Holiday</span>
                    </div>
                </Card>
            </div>

            <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Bell className="w-5 h-5 text-primary-300" />
                    <h2 className="text-lg font-semibold text-white">Notifications</h2>
                </div>
                {data.notifications.length === 0 ? (
                    <p className="text-white/55 text-sm">No recent notifications.</p>
                ) : (
                    <div className="space-y-2">
                        {data.notifications.map((item) => (
                            <div key={item.id} className="p-3 rounded-xl border border-white/10 bg-white/5">
                                <p className="text-sm text-white">{item.message}</p>
                                <p className="text-xs text-white/50 mt-1">
                                    {new Date(item.timestamp).toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

const FacultyDashboard: React.FC<{ data: FacultyDashboardData }> = ({ data }) => (
    <div className="space-y-6 animate-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-white">Faculty Dashboard</h1>
                <p className="text-white/55">Today&apos;s classes and live attendance controls.</p>
            </div>
            <Link to={data.live_attendance.quick_action_route}>
                <Button icon={PlayCircle}>Start Attendance</Button>
            </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatTile label="Today's Classes" value={data.summary.today_class_count} />
            <StatTile label="Total Students" value={data.summary.total_students} />
            <StatTile label="Present Count" value={data.summary.present_count} />
            <StatTile label="Shortage Records" value={data.report_summary.shortage_records} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-4">
                <h2 className="text-lg font-semibold text-white mb-3">Today&apos;s Classes</h2>
                {data.today_classes.length === 0 ? (
                    <p className="text-white/55 text-sm">No classes scheduled for today.</p>
                ) : (
                    <div className="space-y-2">
                        {data.today_classes.map((course) => (
                            <div key={course.course_id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-white font-medium">{course.course_code} - {course.course_name}</p>
                                <p className="text-xs text-white/55">Time: {course.time || 'Not set'}</p>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Card className="p-4">
                <h2 className="text-lg font-semibold text-white mb-3">Reports Snapshot</h2>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-white/65">Daily Attendance</span>
                        <span className="text-white font-semibold">{data.report_summary.daily_attendance_rate.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-white/65">Monthly Attendance</span>
                        <span className="text-white font-semibold">{data.report_summary.monthly_attendance_rate.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-white/65">Unknown Face Alerts</span>
                        <span className="text-white font-semibold">{data.live_attendance.unknown_face_alerts}</span>
                    </div>
                </div>
            </Card>
        </div>

        <Card className="overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-300" />
                <h2 className="text-lg font-semibold text-white">Live Recognized Students</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-white/60 bg-white/5">
                            <th className="px-4 py-3">Student</th>
                            <th className="px-4 py-3">Course</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.live_attendance.recognized_students.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-white/55">
                                    No recognized students yet for today.
                                </td>
                            </tr>
                        ) : (
                            data.live_attendance.recognized_students.map((entry) => (
                                <tr key={entry.attendance_id} className="border-t border-white/10">
                                    <td className="px-4 py-4 text-white">
                                        {entry.student_name}
                                        <p className="text-xs text-white/50">{entry.student_id}</p>
                                    </td>
                                    <td className="px-4 py-4 text-white/80">{entry.course_code}</td>
                                    <td className="px-4 py-4">
                                        <Badge variant={entry.status === 'present' ? 'present' : entry.status === 'late' ? 'late' : 'absent'}>
                                            {entry.status.toUpperCase()}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-4 text-white/80">{entry.time}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    </div>
);

const AdminDashboard: React.FC<{ data: AdminDashboardData }> = ({ data }) => (
    <div className="space-y-6 animate-in">
        <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <StatTile label="Students" value={data.user_counts.students} />
            <StatTile label="Faculty" value={data.user_counts.faculty} />
            <StatTile label="Admins" value={data.user_counts.admins} />
            <StatTile label="Overall Attendance" value={`${data.summary.overall_attendance_percentage.toFixed(1)}%`} />
            <StatTile label="Attendance Records" value={data.summary.total_records} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <AttendanceTrendChart data={data.attendance_trends} title="Attendance Trends" />
            </div>
            <Card className="p-4">
                <h2 className="text-lg font-semibold text-white mb-3">Top Performing Class</h2>
                {data.top_performing_class ? (
                    <div className="space-y-2">
                        <p className="text-white text-lg font-semibold">
                            {data.top_performing_class.course_code} - {data.top_performing_class.course_name}
                        </p>
                        <p className="text-primary-300 text-2xl font-bold">
                            {data.top_performing_class.attendance_percentage.toFixed(1)}%
                        </p>
                    </div>
                ) : (
                    <p className="text-white/55 text-sm">No class performance data yet.</p>
                )}

                <div className="mt-6 pt-4 border-t border-white/10 space-y-2 text-sm">
                    <p className="text-white/65">
                        Threshold: <span className="text-white">{data.system_settings.attendance_threshold}%</span>
                    </p>
                    <p className="text-white/65">
                        Backup: <span className="text-white">{data.system_settings.backup_enabled ? 'Enabled' : 'Disabled'}</span>
                    </p>
                    <p className="text-white/65">
                        Camera Mode: <span className="text-white">{data.system_settings.camera_mode}</span>
                    </p>
                </div>
            </Card>
        </div>

        <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
                <Upload className="w-5 h-5 text-primary-300" />
                <h2 className="text-lg font-semibold text-white">Recommended Admin Upload Workflow</h2>
            </div>
            <p className="text-sm text-white/55 mb-3">
                Follow this sequence to avoid dependency errors while setting up a semester.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 text-sm">
                <Link to="/upload-departments" className="text-primary-300 hover:text-primary-200">1. Upload Departments</Link>
                <Link to="/upload-classes" className="text-primary-300 hover:text-primary-200">2. Upload Classes</Link>
                <Link to="/upload-faculty" className="text-primary-300 hover:text-primary-200">3. Upload Faculty</Link>
                <Link to="/upload-courses" className="text-primary-300 hover:text-primary-200">4. Upload Courses</Link>
                <Link to="/upload-students" className="text-primary-300 hover:text-primary-200">5. Upload Students</Link>
                <Link to="/upload-timetable" className="text-primary-300 hover:text-primary-200">6. Upload Timetable</Link>
            </div>
            <p className="text-xs text-white/40 mt-3">
                For departments, manual add is also available in Class Setup.
            </p>
        </Card>

        <Card className="overflow-hidden">
            <div className="p-4 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white">Department Attendance</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-white/60 bg-white/5">
                            <th className="px-4 py-3">Department</th>
                            <th className="px-4 py-3">Students</th>
                            <th className="px-4 py-3">Attendance %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.department_attendance.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-white/55">
                                    No department analytics available.
                                </td>
                            </tr>
                        ) : (
                            data.department_attendance.map((department) => (
                                <tr key={department.department} className="border-t border-white/10">
                                    <td className="px-4 py-4 text-white">{department.department}</td>
                                    <td className="px-4 py-4 text-white/80">{department.student_count}</td>
                                    <td className="px-4 py-4">
                                        <span className={department.attendance_percentage < data.threshold ? 'text-danger-300' : 'text-success-300'}>
                                            {department.attendance_percentage.toFixed(1)}%
                                        </span>
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

const DashboardSkeleton: React.FC = () => (
    <div className="space-y-4 animate-pulse">
        <div className="h-28 rounded-2xl bg-white/10 border border-white/10" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-24 rounded-2xl bg-white/10 border border-white/10" />
            <div className="h-24 rounded-2xl bg-white/10 border border-white/10" />
            <div className="h-24 rounded-2xl bg-white/10 border border-white/10" />
        </div>
        <div className="h-80 rounded-2xl bg-white/10 border border-white/10" />
    </div>
);

export const Dashboard: React.FC = () => {
    const { user } = useAuthStore();
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

    useEffect(() => {
        const loadDashboard = async () => {
            if (!user) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const data = await attendanceApi.getDashboard(month, 75);
                setDashboard(data);
            } catch (error) {
                console.error('Failed to load dashboard:', error);
                toast.error('Unable to load dashboard data');
            } finally {
                setIsLoading(false);
            }
        };

        loadDashboard();
    }, [month, user]);

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    if (!dashboard) {
        return (
            <Card className="p-6 text-center">
                <p className="text-white/65">Dashboard data is not available.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 text-white/70 text-sm">
                    <GraduationCap className="w-4 h-4 text-primary-300" />
                    <span>College Attendance Portal</span>
                    <span className="uppercase text-xs px-2 py-0.5 rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-200">
                        {dashboard.role}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <Clock3 className="w-4 h-4 text-white/60" />
                    <input
                        type="month"
                        value={month}
                        onChange={(event) => setMonth(event.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                </div>
            </div>

            {dashboard.role === 'student' ? <StudentDashboard data={dashboard} /> : null}
            {dashboard.role === 'faculty' ? <FacultyDashboard data={dashboard} /> : null}
            {dashboard.role === 'admin' ? <AdminDashboard data={dashboard} /> : null}

            {dashboard.role === 'faculty' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4">
                        <div className="flex items-center gap-2 text-white">
                            <PlayCircle className="w-5 h-5 text-primary-300" />
                            <span>Live Attendance</span>
                        </div>
                        <Link to="/attendance" className="inline-block mt-3 text-primary-300 text-sm">Open attendance page</Link>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-2 text-white">
                            <TrendingUp className="w-5 h-5 text-primary-300" />
                            <span>Reports</span>
                        </div>
                        <Link to="/analytics" className="inline-block mt-3 text-primary-300 text-sm">Open reports</Link>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-2 text-white">
                            <CheckCircle2 className="w-5 h-5 text-primary-300" />
                            <span>Leave Approval</span>
                        </div>
                        <Link to="/leave-approvals" className="inline-block mt-3 text-primary-300 text-sm">Open approvals</Link>
                    </Card>
                </div>
            ) : null}
        </div>
    );
};
