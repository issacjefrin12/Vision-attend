import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button, Card } from '../components/ui';
import { academicsApi, coursesApi, timetableApi, usersApi } from '../services/endpoints';
import { useAuthStore } from '../store/authStore';
import type { AcademicClass, Course, TimetableViewRow, User } from '../types';

const dayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const Timetable: React.FC = () => {
    const { user } = useAuthStore();
    const [viewRows, setViewRows] = useState<TimetableViewRow[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [classes, setClasses] = useState<AcademicClass[]>([]);
    const [facultyUsers, setFacultyUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isViewLoading, setIsViewLoading] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [deletingRowId, setDeletingRowId] = useState<number | null>(null);

    const [classId, setClassId] = useState<number | undefined>(undefined);
    const [subjectId, setSubjectId] = useState<number | undefined>(undefined);
    const [facultyId, setFacultyId] = useState<number | undefined>(undefined);
    const [dayOfWeek, setDayOfWeek] = useState('Monday');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');
    const isFacultyOrStudent = user?.role === 'faculty' || user?.role === 'student';

    const classLabel = (id: number) => {
        const classRow = classes.find((item) => item.id === id);
        if (!classRow) return `Class ${id}`;
        return `${classRow.department_code} - Year ${classRow.year} Sec ${classRow.section}`;
    };

    const viewTitle = useMemo(() => {
        if (user?.role === 'faculty') return 'My Schedule';
        if (user?.role === 'student') return 'My Weekly Schedule';
        return 'Class Weekly Schedule';
    }, [user?.role]);

    const sortedViewRows = useMemo(() => {
        const dayOrder = new Map(dayOptions.map((day, index) => [day, index]));
        return [...viewRows].sort((a, b) => {
            const dayCompare = (dayOrder.get(a.day_of_week) ?? 99) - (dayOrder.get(b.day_of_week) ?? 99);
            if (dayCompare !== 0) return dayCompare;
            const startCompare = a.start_time.localeCompare(b.start_time);
            if (startCompare !== 0) return startCompare;
            return a.end_time.localeCompare(b.end_time);
        });
    }, [viewRows]);

    const timeSlots = useMemo(() => {
        const seen = new Set<string>();
        const slots: string[] = [];
        sortedViewRows.forEach((row) => {
            const slot = `${row.start_time} - ${row.end_time}`;
            if (!seen.has(slot)) {
                seen.add(slot);
                slots.push(slot);
            }
        });
        return slots;
    }, [sortedViewRows]);

    const scheduleMatrix = useMemo(() => {
        const matrix: Record<string, Record<string, TimetableViewRow[]>> = {};
        timeSlots.forEach((slot) => {
            matrix[slot] = {};
            dayOptions.forEach((day) => {
                matrix[slot][day] = [];
            });
        });
        sortedViewRows.forEach((row) => {
            const slot = `${row.start_time} - ${row.end_time}`;
            if (!matrix[slot]) matrix[slot] = {};
            if (!matrix[slot][row.day_of_week]) matrix[slot][row.day_of_week] = [];
            matrix[slot][row.day_of_week].push(row);
        });
        return matrix;
    }, [sortedViewRows, timeSlots]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [subjects, classRows] = await Promise.all([
                coursesApi.getAll(),
                academicsApi.listClasses(),
            ]);
            setCourses(subjects);
            setClasses(classRows);

            if (subjects.length > 0) setSubjectId(subjects[0].id);
            if (classRows.length > 0) setClassId(classRows[0].id);

            if (user?.role === 'admin') {
                const userRows = await usersApi.getAll();
                const facultyRows = userRows.filter((row) => row.role === 'faculty' && row.is_active);
                setFacultyUsers(facultyRows);
                if (facultyRows.length > 0) setFacultyId(facultyRows[0].id);
            }
        } catch {
            toast.error('Failed to load timetable');
        } finally {
            setIsLoading(false);
        }
    };

    const loadViewSchedule = async () => {
        setIsViewLoading(true);
        try {
            if (user?.role === 'faculty') {
                const data = await timetableApi.mySchedule();
                setViewRows(data);
            } else if (user?.role === 'student') {
                const data = await timetableApi.myClassSchedule();
                setViewRows(data);
            } else if (user?.role === 'admin' && classId) {
                const data = await timetableApi.classSchedule(classId);
                setViewRows(data);
            } else {
                setViewRows([]);
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to load schedule');
            setViewRows([]);
        } finally {
            setIsViewLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [user?.role]);

    useEffect(() => {
        loadViewSchedule();
    }, [user?.role, classId]);

    const addRow = async () => {
        if (!classId) {
            toast.error('Select class');
            return;
        }
        if (!subjectId) {
            toast.error('Select subject');
            return;
        }
        if (!facultyId) {
            toast.error('Select faculty');
            return;
        }
        setIsAdding(true);
        try {
            await timetableApi.create({
                faculty_id: facultyId,
                class_id: classId,
                subject_id: subjectId,
                day_of_week: dayOfWeek,
                start_time: startTime,
                end_time: endTime,
            });
            await loadViewSchedule();
            toast.success('Timetable row added');
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to add timetable row');
        } finally {
            setIsAdding(false);
        }
    };

    const deleteRow = async (timetableId: number) => {
        const confirmed = window.confirm('Delete this timetable slot?');
        if (!confirmed) return;

        setDeletingRowId(timetableId);
        try {
            await timetableApi.delete(timetableId);
            await loadViewSchedule();
            toast.success('Timetable slot deleted');
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to delete timetable slot');
        } finally {
            setDeletingRowId(null);
        }
    };

    return (
        <div className="space-y-6 animate-in">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <CalendarDays className="w-7 h-7 text-primary-300" />
                    {viewTitle}
                </h1>
            </div>

            {user?.role === 'admin' ? (
                <Card className="p-5 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Add Timetable Row</h2>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <div>
                            <label className="block text-sm text-white/70 mb-2">Class</label>
                            <select
                                value={classId || ''}
                                onChange={(event) => setClassId(Number(event.target.value))}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white"
                            >
                                {classes.map((classRow) => (
                                    <option key={classRow.id} value={classRow.id}>
                                        {classRow.department_name} - Year {classRow.year} Sec {classRow.section}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-white/70 mb-2">Subject</label>
                            <select
                                value={subjectId || ''}
                                onChange={(event) => setSubjectId(Number(event.target.value))}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white"
                            >
                                {courses.map((course) => (
                                    <option key={course.id} value={course.id}>
                                        {course.code} - {course.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-white/70 mb-2">Faculty</label>
                            <select
                                value={facultyId || ''}
                                onChange={(event) => setFacultyId(Number(event.target.value))}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white"
                            >
                                {facultyUsers.length === 0 ? (
                                    <option value="">No faculty users found</option>
                                ) : (
                                    facultyUsers.map((faculty) => (
                                        <option key={faculty.id} value={faculty.id}>
                                            {faculty.id} - {faculty.full_name}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-white/70 mb-2">Day</label>
                            <select
                                value={dayOfWeek}
                                onChange={(event) => setDayOfWeek(event.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white"
                            >
                                {dayOptions.map((day) => (
                                    <option key={day} value={day}>{day}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-white/70 mb-2">Start</label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(event) => setStartTime(event.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-white/70 mb-2">End</label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={(event) => setEndTime(event.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white"
                            />
                        </div>
                    </div>
                    <Button icon={Plus} onClick={addRow} isLoading={isAdding}>
                        Add Row
                    </Button>
                </Card>
            ) : null}

            {isFacultyOrStudent ? (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px]">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-white/60 bg-white/5">
                                    <th className="px-4 py-3 w-40">Time</th>
                                    {dayOptions.map((day) => (
                                        <th key={day} className="px-4 py-3">{day}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {isViewLoading ? (
                                    <tr>
                                        <td colSpan={dayOptions.length + 1} className="px-4 py-8 text-center text-white/55">Loading...</td>
                                    </tr>
                                ) : timeSlots.length === 0 ? (
                                    <tr>
                                        <td colSpan={dayOptions.length + 1} className="px-4 py-8 text-center text-white/55">No schedule rows found.</td>
                                    </tr>
                                ) : (
                                    timeSlots.map((slot) => (
                                        <tr key={slot} className="border-t border-white/10 align-top">
                                            <td className="px-4 py-4 text-white/80 font-medium">{slot}</td>
                                            {dayOptions.map((day) => {
                                                const cellRows = scheduleMatrix[slot]?.[day] || [];
                                                return (
                                                    <td key={`${slot}-${day}`} className="px-4 py-4 text-white/80">
                                                        {cellRows.length === 0 ? (
                                                            <span className="text-white/30">-</span>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {cellRows.map((row) => (
                                                                    <div key={row.timetable_id} className="rounded-lg bg-white/5 p-2">
                                                                        <p className="text-white text-sm font-medium">{row.course_code} - {row.course_name}</p>
                                                                        {user?.role === 'faculty' ? (
                                                                            <p className="text-xs text-white/60 mt-1">
                                                                                {row.department_code} Y{row.year} {row.section}
                                                                            </p>
                                                                        ) : (
                                                                            <p className="text-xs text-white/60 mt-1">{row.faculty_name}</p>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ) : (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-white/60 bg-white/5">
                                    <th className="px-4 py-3">Day</th>
                                    <th className="px-4 py-3">Time</th>
                                    <th className="px-4 py-3">Course</th>
                                    <th className="px-4 py-3">Class</th>
                                    <th className="px-4 py-3">Faculty</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isViewLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-white/55">Loading...</td>
                                    </tr>
                                ) : sortedViewRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-white/55">No schedule rows found.</td>
                                    </tr>
                                ) : (
                                    sortedViewRows.map((row) => (
                                        <tr key={row.timetable_id} className="border-t border-white/10">
                                            <td className="px-4 py-4 text-white/80">{row.day_of_week}</td>
                                            <td className="px-4 py-4 text-white/80">
                                                {row.start_time} - {row.end_time}
                                            </td>
                                            <td className="px-4 py-4 text-white/80">
                                                {row.course_code} - {row.course_name}
                                            </td>
                                            <td className="px-4 py-4 text-white/80">
                                                {row.department_code} Y{row.year} {row.section}
                                            </td>
                                            <td className="px-4 py-4 text-white/80">
                                                {row.faculty_name}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => deleteRow(row.timetable_id)}
                                                    disabled={deletingRowId === row.timetable_id}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-danger-300 hover:text-danger-200 hover:bg-danger-500/10 disabled:opacity-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    {deletingRowId === row.timetable_id ? 'Deleting...' : 'Delete'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
};
