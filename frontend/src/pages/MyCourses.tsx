import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Users, Clock, Calendar, GraduationCap } from 'lucide-react';
import { Card, Badge } from '../components/ui';
import { attendanceApi, timetableApi } from '../services/endpoints';
import type { StudentDashboardData, TimetableViewRow } from '../types';
import toast from 'react-hot-toast';

interface CourseCard {
    id: number;
    code: string;
    name: string;
    faculty_names: string[];
    schedule: {
        days: string[];
        times: string[];
    };
    total_classes: number;
    attended_classes: number;
    attendance_percentage: number;
}

export const MyCourses: React.FC = () => {
    const [courses, setCourses] = useState<CourseCard[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const dayOrder = new Map([
            ['Mon', 1],
            ['Tue', 2],
            ['Wed', 3],
            ['Thu', 4],
            ['Fri', 5],
            ['Sat', 6],
            ['Sun', 7],
        ]);
        const dayToken = (dayOfWeek: string) => dayOfWeek.slice(0, 3);
        const formatTime = (value: string) => value.slice(0, 5);
        const timeRange = (row: TimetableViewRow) => `${formatTime(row.start_time)} - ${formatTime(row.end_time)}`;

        const loadMyCourses = async () => {
            setIsLoading(true);
            try {
                const [scheduleRows, dashboard] = await Promise.all([
                    timetableApi.myClassSchedule(),
                    attendanceApi.getDashboard(undefined, 75),
                ]);

                if (dashboard.role !== 'student') {
                    setCourses([]);
                    return;
                }

                const studentDashboard = dashboard as StudentDashboardData;
                const attendanceMap = new Map(
                    studentDashboard.subject_attendance.map((row) => [row.course_id, row])
                );

                const grouped = new Map<
                    number,
                    {
                        id: number;
                        code: string;
                        name: string;
                        facultyNames: Set<string>;
                        days: Set<string>;
                        times: Set<string>;
                    }
                >();

                for (const row of scheduleRows) {
                    const existing = grouped.get(row.course_id) ?? {
                        id: row.course_id,
                        code: row.course_code,
                        name: row.course_name,
                        facultyNames: new Set<string>(),
                        days: new Set<string>(),
                        times: new Set<string>(),
                    };

                    if (row.faculty_name) existing.facultyNames.add(row.faculty_name);
                    existing.days.add(dayToken(row.day_of_week));
                    existing.times.add(timeRange(row));
                    grouped.set(row.course_id, existing);
                }

                const cards: CourseCard[] = Array.from(grouped.values())
                    .map((item) => {
                        const attendance = attendanceMap.get(item.id);
                        return {
                            id: item.id,
                            code: item.code,
                            name: item.name,
                            faculty_names: Array.from(item.facultyNames),
                            schedule: {
                                days: Array.from(item.days).sort(
                                    (a, b) => (dayOrder.get(a) ?? 99) - (dayOrder.get(b) ?? 99)
                                ),
                                times: Array.from(item.times).sort(),
                            },
                            total_classes: attendance?.total_classes ?? 0,
                            attended_classes: attendance?.attended_classes ?? 0,
                            attendance_percentage: attendance?.attendance_percentage ?? 0,
                        };
                    })
                    .sort((a, b) => a.code.localeCompare(b.code));

                setCourses(cards);
            } catch (error) {
                console.error('Failed to load student subjects:', error);
                toast.error('Failed to load your subjects');
                setCourses([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadMyCourses();
    }, []);

    const getAttendanceRate = (course: CourseCard) => {
        if (course.total_classes > 0) {
            return Math.round((course.attended_classes / course.total_classes) * 100);
        }
        return Math.round(course.attendance_percentage || 0);
    };

    const getAttendanceVariant = (rate: number): 'present' | 'late' | 'absent' => {
        if (rate >= 75) return 'present';
        if (rate >= 50) return 'late';
        return 'absent';
    };

    const coursesCountLabel = useMemo(() => {
        if (isLoading) return '';
        return `${courses.length} subject${courses.length === 1 ? '' : 's'} in your timetable`;
    }, [courses.length, isLoading]);

    const getAttendanceRatio = (course: CourseCard) => {
        if (course.total_classes > 0) {
            return `${course.attended_classes}/${course.total_classes}`;
        }
        return '0/0';
    };

    const getAttendanceBarWidth = (course: CourseCard) => {
        const rate = getAttendanceRate(course);
        return Math.max(0, Math.min(100, rate));
    };

    return (
        <div className="space-y-6 animate-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BookOpen className="w-7 h-7 text-primary-400" />
                        My Courses
                    </h1>
                    <p className="text-white/50">
                        View your class timetable subjects and attendance {coursesCountLabel ? `(${coursesCountLabel})` : ''}
                    </p>
                </div>
            </div>

            {/* Courses Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    [...Array(3)].map((_, i) => (
                        <Card key={i} className="p-6">
                            <div className="animate-pulse space-y-4">
                                <div className="h-6 bg-white/10 rounded w-3/4" />
                                <div className="h-4 bg-white/10 rounded w-1/2" />
                                <div className="h-20 bg-white/10 rounded" />
                            </div>
                        </Card>
                    ))
                ) : courses.length === 0 ? (
                    <div className="col-span-full">
                        <Card className="p-12 text-center">
                            <GraduationCap className="w-16 h-16 text-white/20 mx-auto mb-4" />
                            <p className="text-white/50 text-lg">No subjects in your timetable</p>
                            <p className="text-white/30 text-sm mt-2">Ask admin to add timetable rows for your class.</p>
                        </Card>
                    </div>
                ) : (
                    courses.map((course) => {
                        const attendanceRate = getAttendanceRate(course);
                        return (
                            <Card key={course.id} className="p-6 hover:ring-2 hover:ring-primary-500/50 transition-all">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <p className="text-sm text-primary-400 font-medium">{course.code}</p>
                                        <h3 className="text-lg font-semibold text-white">{course.name}</h3>
                                    </div>
                                    <Badge variant={getAttendanceVariant(attendanceRate)}>
                                        {attendanceRate}%
                                    </Badge>
                                </div>

                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center gap-2 text-white/70">
                                        <Users className="w-4 h-4" />
                                        <span>{course.faculty_names.join(', ') || 'Faculty not assigned'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-white/70">
                                        <Calendar className="w-4 h-4" />
                                        <span>{course.schedule.days.join(', ')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-white/70">
                                        <Clock className="w-4 h-4" />
                                        <span>{course.schedule.times.join(' | ')}</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/10">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-white/50">Attendance</span>
                                        <span className="text-white">{getAttendanceRatio(course)}</span>
                                    </div>
                                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all ${attendanceRate >= 75 ? 'bg-success-500' :
                                                    attendanceRate >= 50 ? 'bg-warning-500' : 'bg-danger-500'
                                                }`}
                                            style={{ width: `${getAttendanceBarWidth(course)}%` }}
                                        />
                                    </div>
                                </div>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
};
