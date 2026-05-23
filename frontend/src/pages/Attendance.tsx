import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Camera,
    CheckCheck,
    Clock3,
    Download,
    ListChecks,
    PlayCircle,
    PowerOff,
    ScanFace,
    Search,
    Timer,
    XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Card, Badge, Button, Input } from '../components/ui';
import { Camera as CameraCapture } from '../components/camera';
import { academicsApi, attendanceApi, coursesApi, sessionsApi } from '../services/endpoints';
import type {
    AcademicClass,
    AttendanceSession,
    ClassStudentAttendanceRow,
    Course,
    EntryStatusResponse,
    SessionMarkResponse,
} from '../types';

const formatRemaining = (expiryTime: string): string => {
    const ms = new Date(expiryTime).getTime() - Date.now();
    if (ms <= 0) return '00:00';
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

type ManualModeStudent = ClassStudentAttendanceRow & {
    status: 'present' | 'absent' | 'late';
};

export const Attendance: React.FC = () => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [classes, setClasses] = useState<AcademicClass[]>([]);
    const [isLoadingCourses, setIsLoadingCourses] = useState(true);
    const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);
    const [currentSession, setCurrentSession] = useState<AttendanceSession | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [isMarking, setIsMarking] = useState(false);
    const [markedCount, setMarkedCount] = useState(0);
    const [lastResult, setLastResult] = useState<SessionMarkResponse | null>(null);
    const [entryStatus, setEntryStatus] = useState<EntryStatusResponse | null>(null);
    const [isLoadingEntryStatus, setIsLoadingEntryStatus] = useState(false);
    const [manualMarkingStudentId, setManualMarkingStudentId] = useState<number | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [manualModeEnabled, setManualModeEnabled] = useState(false);
    const [manualStudents, setManualStudents] = useState<ManualModeStudent[]>([]);
    const [manualSearch, setManualSearch] = useState('');
    const [isLoadingManualStudents, setIsLoadingManualStudents] = useState(false);
    const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

    const [sessionType, setSessionType] = useState<'entry' | 'hourly'>('entry');
    const [entryMode, setEntryMode] = useState<'code' | 'webcam'>('code');
    const [classId, setClassId] = useState<number | null>(null);
    const [subjectId, setSubjectId] = useState<number | undefined>(undefined);
    const [durationSeconds, setDurationSeconds] = useState(90);
    const [remaining, setRemaining] = useState('00:00');

    const selectedCourseName = useMemo(
        () => courses.find((course) => course.id === subjectId)?.name || 'Not selected',
        [courses, subjectId]
    );

    const currentSessionCourseName = useMemo(() => {
        if (!currentSession?.subject_id) return 'Entry Session';
        return (
            courses.find((course) => course.id === currentSession.subject_id)?.name ||
            selectedCourseName
        );
    }, [courses, currentSession?.subject_id, selectedCourseName]);

    const filteredManualStudents = useMemo(() => {
        const keyword = manualSearch.trim().toLowerCase();
        if (!keyword) return manualStudents;
        return manualStudents.filter(
            (row) =>
                row.full_name.toLowerCase().includes(keyword) ||
                row.register_no.toLowerCase().includes(keyword) ||
                row.student_id.toLowerCase().includes(keyword)
        );
    }, [manualSearch, manualStudents]);

    const refreshActiveSessions = useCallback(async () => {
        try {
            const data = await sessionsApi.active(classId ?? undefined);
            setActiveSessions(data);
            const classSession = data.find((session) => session.class_id === classId) || null;
            setCurrentSession(classSession);
            if (classSession) setMarkedCount(0);
        } catch {
            setActiveSessions([]);
            setCurrentSession(null);
        }
    }, [classId]);

    const loadEntryStatus = useCallback(
        async (showError = false) => {
            if (!classId) {
                setEntryStatus(null);
                return;
            }
            setIsLoadingEntryStatus(true);
            try {
                const data = await attendanceApi.getEntryStatus(classId, undefined, currentSession?.id);
                setEntryStatus(data);
            } catch (error: any) {
                setEntryStatus(null);
                if (showError) {
                    toast.error(error?.response?.data?.detail || 'Failed to load attendance status');
                }
            } finally {
                setIsLoadingEntryStatus(false);
            }
        },
        [classId, currentSession?.id]
    );

    const loadManualModeStudents = useCallback(async () => {
        if (!classId) {
            toast.error('Select class first');
            return;
        }
        setIsLoadingManualStudents(true);
        try {
            const rows = await attendanceApi.getClassStudentsForAttendance(
                classId,
                currentSession?.id
            );
            setManualStudents(rows.map((row) => ({ ...row, status: row.current_status || 'present' })));
            setManualModeEnabled(true);
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to load class students');
        } finally {
            setIsLoadingManualStudents(false);
        }
    }, [classId, currentSession]);

    useEffect(() => {
        const load = async () => {
            setIsLoadingCourses(true);
            try {
                const [subjects, classRows] = await Promise.all([
                    coursesApi.getAll(),
                    academicsApi.listClasses(),
                ]);
                setCourses(subjects);
                setClasses(classRows);
                if (subjects.length > 0) setSubjectId(subjects[0].id);
                if (classRows.length > 0) setClassId(classRows[0].id);
            } catch {
                toast.error('Failed to load subjects');
            } finally {
                setIsLoadingCourses(false);
            }
        };
        void load();
    }, []);

    useEffect(() => {
        if (classId !== null) {
            void refreshActiveSessions();
            void loadEntryStatus();
        }
    }, [classId, refreshActiveSessions, loadEntryStatus]);

    useEffect(() => {
        if (classId === null) return;
        const poller = setInterval(() => void loadEntryStatus(), 15000);
        return () => clearInterval(poller);
    }, [classId, loadEntryStatus]);

    useEffect(() => {
        if (!currentSession) {
            setRemaining('00:00');
            return;
        }
        const timer = setInterval(() => {
            const value = formatRemaining(currentSession.expiry_time);
            setRemaining(value);
            if (value === '00:00') setCurrentSession(null);
        }, 1000);
        return () => clearInterval(timer);
    }, [currentSession]);

    useEffect(() => {
        setManualModeEnabled(false);
        setManualStudents([]);
        setManualSearch('');
    }, [classId, currentSession?.id]);

    const startSession = async () => {
        if (sessionType === 'hourly' && !subjectId) {
            toast.error('Select subject for hourly session');
            return;
        }
        if (!classId) {
            toast.error('Select class to start session');
            return;
        }
        setIsStarting(true);
        try {
            const created = await sessionsApi.start({
                class_id: classId,
                subject_id: sessionType === 'hourly' ? subjectId : undefined,
                session_type: sessionType,
                duration_seconds: durationSeconds,
                entry_mode: entryMode,
            });
            setCurrentSession(created);
            setMarkedCount(0);
            setLastResult(null);
            toast.success(`Session started. Code: ${created.session_code}`);
            await refreshActiveSessions();
            await loadEntryStatus();
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to start session');
        } finally {
            setIsStarting(false);
        }
    };

    const closeSession = async () => {
        if (!currentSession) return;
        setIsClosing(true);
        try {
            await sessionsApi.close(currentSession.id);
            setCurrentSession(null);
            setLastResult(null);
            setManualModeEnabled(false);
            setManualStudents([]);
            toast.success('Session closed');
            await refreshActiveSessions();
            await loadEntryStatus();
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to close session');
        } finally {
            setIsClosing(false);
        }
    };

    const handleCapture = useCallback(
        async (imageBase64: string) => {
            if (!currentSession) {
                toast.error('Start a session first');
                return;
            }
            setIsMarking(true);
            try {
                const result = await sessionsApi.mark({
                    session_id: currentSession.id,
                    image_base64: imageBase64,
                });
                setLastResult(result);
                if (result.success) {
                    setMarkedCount(result.marked_count || markedCount + 1);
                    toast.success(result.message);
                    await loadEntryStatus();
                } else {
                    toast.error(result.message);
                }
            } catch (error: any) {
                toast.error(error?.response?.data?.detail || 'Attendance mark failed');
            } finally {
                setIsMarking(false);
            }
        },
        [currentSession, markedCount, loadEntryStatus]
    );

    const toggleStudentStatus = useCallback(async (studentDbId: number, status: 'present' | 'absent') => {
        setManualMarkingStudentId(studentDbId);
        try {
            await attendanceApi.manualMark({
                student_id: studentDbId,
                status,
                type: currentSession?.session_type === 'hourly' ? 'session' : 'entry',
                session_id: currentSession?.id,
                course_id: currentSession?.session_type === 'hourly' ? currentSession.subject_id || undefined : undefined,
            });
            toast.success(status === 'present' ? 'Student marked present manually' : 'Student marked absent manually');
            await loadEntryStatus();
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to update attendance');
        } finally {
            setManualMarkingStudentId(null);
        }
    }, [currentSession, loadEntryStatus]);

    const toggleManualModeStudent = useCallback((studentDbId: number) => {
        setManualStudents((prev) =>
            prev.map((student) =>
                student.id === studentDbId
                    ? { ...student, status: student.status === 'absent' ? 'present' : 'absent' }
                    : student
            )
        );
    }, []);

    const markAllManualPresent = useCallback(() => {
        setManualStudents((prev) => prev.map((student) => ({ ...student, status: 'present' })));
    }, []);

    const submitBulkManualAttendance = useCallback(async () => {
        if (manualStudents.length === 0) {
            toast.error('No students loaded for manual mode');
            return;
        }
        setIsSubmittingBulk(true);
        try {
            if (currentSession) {
                const result = await attendanceApi.bulkMark({
                    session_id: currentSession.id,
                    students: manualStudents.map((student) => ({
                        student_id: student.id,
                        status: student.status === 'late' ? 'present' : student.status,
                    })),
                });
                toast.success(
                    `${result.message}: ${result.present_count} present, ${result.absent_count} absent`
                );
            } else {
                await Promise.all(
                    manualStudents.map((student) =>
                        attendanceApi.manualMark({
                            student_id: student.id,
                            status: student.status === 'late' ? 'present' : student.status,
                            type: 'entry',
                        })
                    )
                );
                const presentCount = manualStudents.filter(
                    (student) => student.status === 'present' || student.status === 'late'
                ).length;
                const absentCount = manualStudents.length - presentCount;
                toast.success(
                    `Manual attendance saved: ${presentCount} present, ${absentCount} absent`
                );
            }
            await loadEntryStatus();
            await loadManualModeStudents();
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to submit bulk attendance');
        } finally {
            setIsSubmittingBulk(false);
        }
    }, [currentSession, loadEntryStatus, loadManualModeStudents, manualStudents]);

    const handleExportAttendance = useCallback(async () => {
        if (!classId) {
            toast.error('Select a class first');
            return;
        }
        setIsExporting(true);
        try {
            await attendanceApi.exportClassAttendance(classId);
            toast.success('Attendance exported successfully!');
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to export attendance');
        } finally {
            setIsExporting(false);
        }
    }, [classId]);

    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-center gap-2">
                <Camera className="w-7 h-7 text-primary-300" />
                <div>
                    <h1 className="text-2xl font-bold text-white">Session Attendance</h1>
                    <p className="text-white/55">Live view + manual correction + mark later mode.</p>
                </div>
            </div>

            <Card className="p-5 space-y-4">
                <h2 className="text-lg font-semibold text-white">Start Session</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        <label className="block text-sm text-white/70 mb-2">Session Type</label>
                        <select
                            value={sessionType}
                            onChange={(event) => setSessionType(event.target.value as 'entry' | 'hourly')}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white"
                        >
                            <option value="entry">Entry</option>
                            <option value="hourly">Hourly</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-white/70 mb-2">Mode</label>
                        <select
                            value={entryMode}
                            onChange={(event) => setEntryMode(event.target.value as 'code' | 'webcam')}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white"
                        >
                            <option value="code">Code Mode</option>
                            <option value="webcam">Webcam/OLED Mode</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-white/70 mb-2">Subject</label>
                        <select
                            value={subjectId || ''}
                            onChange={(event) => setSubjectId(Number(event.target.value))}
                            disabled={isLoadingCourses || sessionType === 'entry'}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white disabled:opacity-50"
                        >
                            {courses.map((course) => (
                                <option key={course.id} value={course.id}>
                                    {course.code} - {course.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-white/70 mb-2">Duration (seconds)</label>
                        <Input
                            type="number"
                            value={durationSeconds}
                            onChange={(event) => setDurationSeconds(Number(event.target.value))}
                        />
                    </div>
                    <div className="flex items-end">
                        <Button
                            icon={PlayCircle}
                            onClick={startSession}
                            isLoading={isStarting}
                            disabled={!!currentSession}
                            className="w-full"
                        >
                            Start Session
                        </Button>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <Card className="p-6">
                        <CameraCapture
                            onCapture={handleCapture}
                            isProcessing={isMarking}
                            lastResult={
                                lastResult
                                    ? {
                                          success: lastResult.success,
                                          message: lastResult.message,
                                          studentName: lastResult.student_name,
                                      }
                                    : null
                            }
                            mode="attendance"
                        />
                    </Card>

                    <Card className="p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h3 className="text-white font-semibold flex items-center gap-2">
                                    <ListChecks className="w-5 h-5 text-primary-300" />
                                    Manual Attendance Mode
                                </h3>
                                <p className="text-white/55 text-xs">
                                    Default all present, mark absentees, then submit all.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={loadManualModeStudents}
                                    isLoading={isLoadingManualStudents}
                                    disabled={!classId}
                                >
                                    Open
                                </Button>
                                {manualModeEnabled ? (
                                    <Button variant="ghost" onClick={() => setManualModeEnabled(false)}>
                                        Hide
                                    </Button>
                                ) : null}
                            </div>
                        </div>

                        {manualModeEnabled ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <Input
                                        icon={Search}
                                        placeholder="Search students"
                                        value={manualSearch}
                                        onChange={(event) => setManualSearch(event.target.value)}
                                    />
                                    <Button variant="outline" onClick={markAllManualPresent}>
                                        Mark All Present
                                    </Button>
                                    <Button
                                        onClick={submitBulkManualAttendance}
                                        isLoading={isSubmittingBulk}
                                        disabled={manualStudents.length === 0}
                                    >
                                        Submit All
                                    </Button>
                                </div>
                                <div className="max-h-72 overflow-y-auto space-y-2">
                                    {filteredManualStudents.map((student) => (
                                        <div
                                            key={student.id}
                                            className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between gap-2"
                                        >
                                            <div>
                                                <p className="text-white text-sm">{student.full_name}</p>
                                                <p className="text-xs text-white/55">
                                                    {student.register_no} | {student.attendance_percentage.toFixed(2)}%
                                                    {student.attendance_percentage < 75 ? (
                                                        <span className="text-danger-300 font-semibold ml-2">⚠ Low</span>
                                                    ) : null}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={student.status === 'absent' ? 'absent' : 'present'}>
                                                    {student.status.toUpperCase()}
                                                </Badge>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => toggleManualModeStudent(student.id)}
                                                >
                                                    {student.status === 'absent' ? 'Mark Present' : 'Mark Absent'}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredManualStudents.length === 0 ? (
                                        <p className="text-white/55 text-sm">No students found.</p>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                    </Card>
                </div>

                <div className="space-y-4">
                    <Card className="p-4">
                        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                            <ScanFace className="w-5 h-5 text-primary-300" />
                            Current Session
                        </h3>
                        {!currentSession ? (
                            <p className="text-white/55 text-sm">No active session for this class.</p>
                        ) : (
                            <div className="space-y-2 text-sm">
                                <p className="text-white/70">Type: <span className="text-white">{currentSession.session_type}</span></p>
                                <p className="text-white/70">Code: <span className="text-primary-300 font-semibold tracking-wider">{currentSession.session_code}</span></p>
                                <p className="text-white/70">Subject: <span className="text-white">{currentSessionCourseName}</span></p>
                                <div className="flex items-center gap-2 mt-2">
                                    <Timer className="w-4 h-4 text-warning-400" />
                                    <span className="text-warning-300 font-semibold">{remaining}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock3 className="w-4 h-4 text-success-400" />
                                    <span className="text-white">{markedCount} marked</span>
                                </div>
                                <Button
                                    variant="danger"
                                    icon={PowerOff}
                                    onClick={closeSession}
                                    isLoading={isClosing}
                                    className="w-full mt-2"
                                >
                                    Close Session
                                </Button>
                            </div>
                        )}
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-white font-semibold flex items-center gap-2">
                                <Download className="w-5 h-5 text-primary-300" />
                                Export
                            </h3>
                            <Button
                                size="sm"
                                icon={Download}
                                onClick={handleExportAttendance}
                                isLoading={isExporting}
                                disabled={!classId}
                            >
                                Export Excel
                            </Button>
                        </div>
                        <p className="text-white/55 text-xs">Download today&apos;s entry attendance.</p>
                    </Card>

                    <Card className="p-4">
                        <h3 className="text-white font-semibold mb-3">
                            {currentSession ? 'Live Session View' : 'Entry Attendance Today'}
                        </h3>
                        {!classId ? (
                            <p className="text-white/55 text-sm">Select class to view attendance.</p>
                        ) : isLoadingEntryStatus && !entryStatus ? (
                            <p className="text-white/55 text-sm">Loading attendance...</p>
                        ) : !entryStatus ? (
                            <p className="text-white/55 text-sm">No attendance data available.</p>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Badge variant="present">Present {entryStatus.present.length}</Badge>
                                    <Badge variant="absent">Absent {entryStatus.absent.length}</Badge>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="rounded-lg border border-success-500/20 bg-success-500/5 p-3">
                                        <p className="text-xs uppercase tracking-wide text-success-300 mb-2">Present</p>
                                        <div className="max-h-40 overflow-y-auto space-y-2">
                                            {entryStatus.present.map((student) => (
                                                <div key={student.id} className="flex items-center justify-between gap-2 text-sm">
                                                    <div>
                                                        <p className="text-white">{student.full_name}</p>
                                                        <p className="text-xs text-white/50">{student.register_no}</p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        icon={XCircle}
                                                        isLoading={manualMarkingStudentId === student.id}
                                                        onClick={() => toggleStudentStatus(student.id, 'absent')}
                                                    >
                                                        Mark Absent
                                                    </Button>
                                                </div>
                                            ))}
                                            {entryStatus.present.length === 0 ? (
                                                <p className="text-xs text-white/50">No students marked present yet.</p>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-danger-500/20 bg-danger-500/5 p-3">
                                        <p className="text-xs uppercase tracking-wide text-danger-300 mb-2">Absent</p>
                                        <div className="max-h-40 overflow-y-auto space-y-2">
                                            {entryStatus.absent.map((student) => (
                                                <div key={student.id} className="flex items-center justify-between gap-2 text-sm">
                                                    <div>
                                                        <p className="text-white">{student.full_name}</p>
                                                        <p className="text-xs text-white/50">{student.register_no}</p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        icon={CheckCheck}
                                                        isLoading={manualMarkingStudentId === student.id}
                                                        onClick={() => toggleStudentStatus(student.id, 'present')}
                                                    >
                                                        Mark Present
                                                    </Button>
                                                </div>
                                            ))}
                                            {entryStatus.absent.length === 0 ? (
                                                <p className="text-xs text-white/50">No absent students.</p>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};
