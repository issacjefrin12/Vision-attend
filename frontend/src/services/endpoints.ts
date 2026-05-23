import api from './api';
import type {
    User, Student, Course, Attendance, AttendanceStats,
    DailyTrend, OverviewStats, AttendanceMarkResponse, EntryStatusResponse, ManualAttendanceMarkResponse,
    LoginCredentials, AuthToken, StudentFormData, UserFormData, DashboardData, LeaveRequest,
    AttendanceSession, SessionMarkResponse, AttendancePolicy, TimetableRow, Department, AcademicClass,
    StudentBulkUploadResult, TimetableBulkUploadResult, FacultyBulkUploadResult, CourseBulkUploadResult,
    DepartmentBulkUploadResult, ClassBulkUploadResult, CourseAssignment, FacultyWorkloadRow, TimetableViewRow,
    ClassLocation, GeofenceRadiusConfig, ClassStudentAttendanceRow, SubjectAttendanceRow
} from '../types';

// Auth API
export const authApi = {
    login: async (credentials: LoginCredentials): Promise<AuthToken> => {
        const { data } = await api.post('/auth/login', credentials);
        return data;
    },

    getCurrentUser: async (): Promise<User> => {
        const { data } = await api.get('/auth/me');
        return data;
    },

    register: async (userData: UserFormData): Promise<User> => {
        const { data } = await api.post('/auth/register', userData);
        return data;
    },

    updateCurrentUser: async (payload: { full_name?: string; profile_image_url?: string | null }): Promise<User> => {
        const { data } = await api.patch('/auth/me', payload);
        return data;
    },
};

// Students API
export const studentsApi = {
    getAll: async (
        params?: { department?: string; semester?: number; class_id?: number }
    ): Promise<Student[]> => {
        const { data } = await api.get('/students/', { params });
        return data;
    },

    getById: async (id: number): Promise<Student> => {
        const { data } = await api.get(`/students/${id}`);
        return data;
    },

    create: async (studentData: StudentFormData): Promise<Student> => {
        const { data } = await api.post('/students/', studentData);
        return data;
    },

    update: async (id: number, studentData: Partial<StudentFormData>): Promise<Student> => {
        const { data } = await api.patch(`/students/${id}`, studentData);
        return data;
    },

    enrollFace: async (id: number, imageBase64: string): Promise<{ success: boolean; message: string }> => {
        const { data } = await api.post(`/students/${id}/enroll-face`, { image_base64: imageBase64 });
        return data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`/students/${id}`);
    },
};

// Attendance API
export const attendanceApi = {
    markByFace: async (
        courseId: number,
        imageBase64: string,
        classStartTime?: string,
        mode: 'daily' | 'hourly' = 'daily'
    ): Promise<AttendanceMarkResponse> => {
        const { data } = await api.post('/attendance/mark',
            {
                course_id: courseId,
                image_base64: imageBase64,
            },
            { params: { class_start_time: classStartTime, mode } }
        );
        return data;
    },

    getMyStats: async (month?: string): Promise<{
        attendance_percentage: number;
        total_working_days: number;
        present_count: number;
        late_count: number;
        absent_count: number;
        total_classes: number;
    }> => {
        const { data } = await api.get('/attendance/my-stats', { params: { month } });
        return data;
    },

    getMyHistory: async (month?: string, limit?: number): Promise<{
        id: number;
        course_name: string;
        course_code: string;
        date: string;
        status: string;
        check_in_time?: string;
    }[]> => {
        const { data } = await api.get('/attendance/my-history', { params: { month, limit } });
        return data;
    },

    getSubjectWise: async (month?: string, threshold?: number): Promise<SubjectAttendanceRow[]> => {
        const { data } = await api.get('/attendance/subject-wise', {
            params: { month, threshold },
        });
        return data;
    },

    getDashboard: async (month?: string, threshold: number = 75): Promise<DashboardData> => {
        const { data } = await api.get('/attendance/dashboard', { params: { month, threshold } });
        return data;
    },

    getCourseAttendance: async (courseId: number, date?: string): Promise<Attendance[]> => {
        const { data } = await api.get(`/attendance/course/${courseId}`, { params: { target_date: date } });
        return data;
    },

    getCourseStats: async (courseId: number, date?: string): Promise<AttendanceStats> => {
        const { data } = await api.get(`/attendance/course/${courseId}/stats`, { params: { target_date: date } });
        return data;
    },

    exportExcel: async (courseId: number, startDate: string, endDate: string): Promise<Blob> => {
        const { data } = await api.get(`/attendance/course/${courseId}/export/excel`, {
            params: { start_date: startDate, end_date: endDate },
            responseType: 'blob',
        });
        return data;
    },

    exportCsv: async (courseId: number, startDate: string, endDate: string): Promise<string> => {
        const { data } = await api.get(`/attendance/course/${courseId}/export/csv`, {
            params: { start_date: startDate, end_date: endDate },
        });
        return data;
    },

    getEntryStatus: async (
        classId: number,
        targetDate?: string,
        sessionId?: number
    ): Promise<EntryStatusResponse> => {
        const { data } = await api.get('/attendance/entry-status', {
            params: { class_id: classId, target_date: targetDate, session_id: sessionId },
        });
        return data;
    },

    manualMark: async (payload: {
        student_id: number;
        status: 'present' | 'late' | 'absent';
        type: 'entry' | 'session';
        session_id?: number;
        course_id?: number;
        date?: string;
    }): Promise<ManualAttendanceMarkResponse> => {
        const { data } = await api.post('/attendance/manual-mark', payload);
        return data;
    },

    getClassStudentsForAttendance: async (
        classId: number,
        sessionId?: number
    ): Promise<ClassStudentAttendanceRow[]> => {
        const { data } = await api.get(`/attendance/class/${classId}/students`, {
            params: { session_id: sessionId },
        });
        return data;
    },

    bulkMark: async (payload: {
        session_id: number;
        students: Array<{ student_id: number; status: 'present' | 'late' | 'absent' }>;
    }): Promise<{
        success: boolean;
        message: string;
        session_id: number;
        updated_count: number;
        present_count: number;
        absent_count: number;
    }> => {
        const { data } = await api.post('/attendance/bulk-mark', payload);
        return data;
    },

    exportClassAttendance: async (classId: number, targetDate?: string): Promise<void> => {
        const { data } = await api.get('/attendance/export', {
            params: { class_id: classId, target_date: targetDate },
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `entry_attendance_class${classId}_${targetDate || new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    },
};

// Analytics API
export const analyticsApi = {
    getTrends: async (courseId: number, days: number = 7): Promise<DailyTrend[]> => {
        const { data } = await api.get(`/analytics/trends/${courseId}`, { params: { days } });
        return data;
    },

    getOverview: async (): Promise<OverviewStats> => {
        const { data } = await api.get('/analytics/overview');
        return data;
    },

    getDepartmentStats: async (): Promise<{ department: string; total: number; average_attendance: number }[]> => {
        const { data } = await api.get('/analytics/department-stats');
        return data;
    },

    getFacultyWorkload: async (): Promise<FacultyWorkloadRow[]> => {
        const { data } = await api.get('/analytics/faculty-workload');
        return data;
    },
};

// Users API (Admin only)
export const usersApi = {
    getAll: async (): Promise<User[]> => {
        const { data } = await api.get('/users/');
        return data;
    },

    getById: async (id: number): Promise<User> => {
        const { data } = await api.get(`/users/${id}`);
        return data;
    },

    update: async (id: number, userData: Partial<User>): Promise<User> => {
        const { data } = await api.patch(`/users/${id}`, userData);
        return data;
    },

    delete: async (id: number): Promise<void> => {
        await api.patch(`/users/${id}`, { is_active: false });
    },
};

// Courses API
export const coursesApi = {
    getAll: async (): Promise<Course[]> => {
        const { data } = await api.get('/courses/');
        return data;
    },

    getById: async (id: number): Promise<Course> => {
        const { data } = await api.get(`/courses/${id}`);
        return data;
    },

    getAssignments: async (id: number): Promise<CourseAssignment[]> => {
        const { data } = await api.get(`/courses/${id}/assignments`);
        return data;
    },

    create: async (courseData: { code: string; name: string; schedule?: object }): Promise<Course> => {
        const { data } = await api.post('/courses/', courseData);
        return data;
    },

    update: async (id: number, courseData: { code?: string; name?: string; schedule?: object }): Promise<Course> => {
        const { data } = await api.patch(`/courses/${id}`, courseData);
        return data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`/courses/${id}`);
    },
};

// Leave API
export const leaveApi = {
    apply: async (payload: { reason: string; from_date: string; to_date: string }): Promise<LeaveRequest> => {
        const { data } = await api.post('/leave/apply', payload);
        return data;
    },

    getMyRequests: async (): Promise<LeaveRequest[]> => {
        const { data } = await api.get('/leave/my-requests');
        return data;
    },

    getPending: async (): Promise<LeaveRequest[]> => {
        const { data } = await api.get('/leave/pending');
        return data;
    },

    approve: async (id: number, comment?: string): Promise<LeaveRequest> => {
        const { data } = await api.put(`/leave/${id}/approve`, { comment });
        return data;
    },

    reject: async (id: number, comment?: string): Promise<LeaveRequest> => {
        const { data } = await api.put(`/leave/${id}/reject`, { comment });
        return data;
    },
};

// Notification API
export const notificationsApi = {
    getMy: async (params?: { unread_only?: boolean; limit?: number }) => {
        const { data } = await api.get('/notifications/my', { params });
        return data;
    },

    markRead: async (id: number) => {
        const { data } = await api.put(`/notifications/${id}/read`);
        return data;
    },

    markAllRead: async () => {
        const { data } = await api.put('/notifications/read-all');
        return data;
    },
};

// Session Attendance API
export const sessionsApi = {
    start: async (payload: {
        class_id: number;
        subject_id?: number;
        session_type: 'entry' | 'hourly';
        duration_seconds: number;
        entry_mode: 'code' | 'webcam';
    }): Promise<AttendanceSession> => {
        const { data } = await api.post('/session/start', payload);
        return data;
    },

    mark: async (payload: {
        session_code?: string;
        session_id?: number;
        image_base64: string;
        lat?: number;
        lon?: number;
    }): Promise<SessionMarkResponse> => {
        const { data } = await api.post('/session/mark', payload);
        return data;
    },

    close: async (sessionId: number): Promise<{ id: number; is_active: boolean; closed_at: string }> => {
        const { data } = await api.post('/session/close', { session_id: sessionId });
        return data;
    },

    active: async (classId?: number): Promise<AttendanceSession[]> => {
        const { data } = await api.get('/session/active', { params: { class_id: classId } });
        return data;
    },

    listPolicies: async (): Promise<AttendancePolicy[]> => {
        const { data } = await api.get('/session/policy');
        return data;
    },

    upsertPolicy: async (
        departmentId: number,
        payload: {
            max_entry_per_day: number;
            entry_start_time: string;
            entry_end_time: string;
            is_active: boolean;
        }
    ): Promise<AttendancePolicy> => {
        const { data } = await api.put(`/session/policy/${departmentId}`, payload);
        return data;
    },
};

// Timetable API
export const timetableApi = {
    list: async (params?: { class_id?: number; day_of_week?: string }): Promise<TimetableRow[]> => {
        const { data } = await api.get('/timetable/', { params });
        return data;
    },

    mySchedule: async (): Promise<TimetableViewRow[]> => {
        const { data } = await api.get('/timetable/faculty/me');
        return data;
    },

    myClassSchedule: async (): Promise<TimetableViewRow[]> => {
        const { data } = await api.get('/timetable/my-class');
        return data;
    },

    classSchedule: async (classId: number): Promise<TimetableViewRow[]> => {
        const { data } = await api.get(`/timetable/class/${classId}`);
        return data;
    },

    create: async (payload: {
        faculty_id?: number;
        class_id: number;
        subject_id: number;
        day_of_week: string;
        start_time: string;
        end_time: string;
    }): Promise<TimetableRow> => {
        const { data } = await api.post('/timetable/', payload);
        return data;
    },

    delete: async (timetableId: number): Promise<void> => {
        await api.delete(`/timetable/${timetableId}`);
    },
};

// Academic structure API
export const academicsApi = {
    listDepartments: async (): Promise<Department[]> => {
        const { data } = await api.get('/academics/departments');
        return data;
    },

    createDepartment: async (payload: { code: string; full_name: string }): Promise<Department> => {
        const { data } = await api.post('/academics/departments', payload);
        return data;
    },

    listClasses: async (): Promise<AcademicClass[]> => {
        const { data } = await api.get('/academics/classes');
        return data;
    },

    createClass: async (payload: { department_code: string; year: number; section: string }): Promise<AcademicClass> => {
        const { data } = await api.post('/academics/classes', payload);
        return data;
    },

    deleteClass: async (classId: number): Promise<{ message: string }> => {
        const { data } = await api.delete(`/academics/classes/${classId}`);
        return data;
    },
};

// Admin upload APIs
export const adminApi = {
    downloadDepartmentsTemplate: async (): Promise<Blob> => {
        const { data } = await api.get('/admin/templates/departments.csv', {
            responseType: 'blob',
        });
        return data;
    },

    uploadDepartmentsCsv: async (file: File): Promise<DepartmentBulkUploadResult> => {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post('/admin/upload-departments', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    downloadClassesTemplate: async (): Promise<Blob> => {
        const { data } = await api.get('/admin/templates/classes.csv', {
            responseType: 'blob',
        });
        return data;
    },

    uploadClassesCsv: async (file: File): Promise<ClassBulkUploadResult> => {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post('/admin/upload-classes', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    downloadStudentsTemplate: async (): Promise<Blob> => {
        const { data } = await api.get('/admin/templates/students.csv', {
            responseType: 'blob',
        });
        return data;
    },

    uploadStudentsCsv: async (file: File): Promise<StudentBulkUploadResult> => {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post('/admin/upload-students', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    downloadTimetableTemplate: async (): Promise<Blob> => {
        const { data } = await api.get('/admin/templates/timetable.csv', {
            responseType: 'blob',
        });
        return data;
    },

    uploadTimetableCsv: async (file: File): Promise<TimetableBulkUploadResult> => {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post('/admin/upload-timetable', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    downloadFacultyTemplate: async (): Promise<Blob> => {
        const { data } = await api.get('/admin/templates/faculty.csv', {
            responseType: 'blob',
        });
        return data;
    },

    uploadFacultyCsv: async (file: File): Promise<FacultyBulkUploadResult> => {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post('/admin/upload-faculty', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    downloadCoursesTemplate: async (): Promise<Blob> => {
        const { data } = await api.get('/admin/templates/courses.csv', {
            responseType: 'blob',
        });
        return data;
    },

    uploadCoursesCsv: async (file: File): Promise<CourseBulkUploadResult> => {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post('/admin/upload-courses', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    updateClassLocation: async (
        classId: number,
        payload: { latitude: number; longitude: number }
    ): Promise<ClassLocation> => {
        const { data } = await api.put(`/admin/class/${classId}/location`, payload);
        return data;
    },

    getClassLocation: async (classId: number): Promise<ClassLocation> => {
        const { data } = await api.get(`/admin/class/${classId}/location`);
        return data;
    },

    clearClassLocation: async (classId: number): Promise<ClassLocation> => {
        const { data } = await api.delete(`/admin/class/${classId}/location`);
        return data;
    },

    getGeofenceRadius: async (): Promise<GeofenceRadiusConfig> => {
        const { data } = await api.get('/admin/settings/geofence-radius');
        return data;
    },

    updateGeofenceRadius: async (maxDistanceKm: number): Promise<GeofenceRadiusConfig> => {
        const { data } = await api.put('/admin/settings/geofence-radius', {
            max_distance_km: maxDistanceKm,
        });
        return data;
    },
};
