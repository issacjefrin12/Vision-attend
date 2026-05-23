// API Types
export interface User {
    id: number;
    email: string;
    full_name: string;
    role: 'admin' | 'faculty' | 'student';
    profile_image_url?: string | null;
    is_active: boolean;
    created_at: string;
}

export interface Student {
    id: number;
    student_id: string;
    register_no?: string;
    user_id?: number | null;
    class_id?: number | null;
    full_name: string;
    email: string;
    department?: string;
    semester?: number;
    face_encoding_path?: string;
    photo_url?: string;
    is_active: boolean;
    created_at: string;
}

export interface Course {
    id: number;
    code: string;
    name: string;
    schedule?: {
        days: string[];
        time: string;
    };
    created_at: string;
}

export interface CourseAssignment {
    class_id: number;
    department_code: string;
    department_full_name: string;
    year: number;
    section: string;
    faculty_id: number;
    faculty_name: string;
    faculty_email: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
}

export interface Attendance {
    id: number;
    student_id: number;
    course_id: number;
    date: string;
    check_in_time: string;
    status: 'present' | 'late' | 'absent';
    confidence_score?: number;
    is_manual?: boolean;
    created_at: string;
}

export interface AttendanceStats {
    total_students: number;
    present_count: number;
    late_count: number;
    absent_count: number;
    attendance_rate: number;
}

export interface DailyTrend {
    date: string;
    present: number;
    late: number;
    absent: number;
}

export interface FacultyWorkloadRow {
    faculty_id: number;
    faculty_name: string;
    faculty_email: string;
    class_count: number;
}

export interface OverviewStats {
    total_students: number;
    total_courses: number;
    today_attendance: number;
    enrolled_faces: number;
    enrollment_rate: number;
}

export interface AttendanceMarkResponse {
    success: boolean;
    message: string;
    student_id?: number;
    student_name?: string;
    status?: 'present' | 'late' | 'absent';
    confidence?: number;
}

export interface EntryStatusStudent {
    id: number;
    student_id: string;
    register_no: string;
    full_name: string;
    status?: 'present' | 'late' | 'absent';
    check_in_time?: string | null;
    attendance_id?: number | null;
    is_manual?: boolean;
}

export interface EntryStatusResponse {
    class_id: number;
    date: string;
    present: EntryStatusStudent[];
    absent: EntryStatusStudent[];
}

export interface ManualAttendanceMarkResponse {
    success: boolean;
    message: string;
    attendance_id: number;
    student_id: number;
    status: 'present' | 'late' | 'absent';
    type: 'entry' | 'session';
    is_manual: boolean;
}

export interface ClassStudentAttendanceRow {
    id: number;
    student_id: string;
    register_no: string;
    full_name: string;
    attendance_percentage: number;
    current_status: 'present' | 'late' | 'absent';
}

export interface LeaveRequest {
    id: number;
    student_id: number;
    student_name: string;
    register_number: string;
    reason: string;
    from_date: string;
    to_date: string;
    status: 'pending' | 'approved' | 'rejected';
    approved_by?: number | null;
    created_at: string;
    updated_at: string;
}

export interface AttendanceSession {
    id: number;
    class_id: number;
    subject_id?: number | null;
    faculty_id: number;
    session_code: string;
    session_type: 'entry' | 'hourly';
    duration_seconds: number;
    start_time: string;
    expiry_time: string;
    is_active: boolean;
    entry_mode: 'code' | 'webcam';
}

export interface SessionMarkResponse {
    success: boolean;
    message: string;
    attendance_id?: number;
    student_id?: number;
    student_name?: string;
    session_id?: number;
    session_type?: 'entry' | 'hourly';
    marked_count?: number;
}

export interface AttendancePolicy {
    id: number;
    department_id: number;
    max_entry_per_day: number;
    entry_start_time: string;
    entry_end_time: string;
    is_active: boolean;
    updated_by?: number | null;
    created_at: string;
    updated_at: string;
}

export interface Department {
    id: number;
    code: string;
    full_name: string;
    created_at: string;
}

export interface AcademicClass {
    id: number;
    department_id: number;
    department_code: string;
    department_full_name: string;
    department_name: string;
    year: number;
    section: string;
    latitude?: number | null;
    longitude?: number | null;
    created_at: string;
}

export interface ClassLocation {
    class_id: number;
    latitude: number | null;
    longitude: number | null;
}

export interface GeofenceRadiusConfig {
    max_distance_km: number;
}

export interface TimetableRow {
    id: number;
    faculty_id: number;
    class_id: number;
    subject_id: number;
    day_of_week: string;
    start_time: string;
    end_time: string;
    created_at: string;
}

export interface TimetableViewRow {
    timetable_id: number;
    class_id: number;
    department_code: string;
    department_full_name: string;
    year: number;
    section: string;
    course_id: number;
    course_code: string;
    course_name: string;
    faculty_id: number;
    faculty_name: string;
    faculty_email: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
}

export interface SubjectAttendanceRow {
    course_id: number;
    subject: string;
    subject_code: string;
    total_classes: number;
    attended_classes: number;
    absent_classes: number;
    attendance_percentage: number;
    below_threshold: boolean;
}

export interface CalendarDayStatus {
    date: string;
    status: 'present' | 'absent' | 'holiday';
}

export interface DashboardNotification {
    id: string;
    category: string;
    message: string;
    timestamp: string;
}

export interface StudentDashboardData {
    role: 'student';
    threshold: number;
    profile: {
        name: string;
        register_number: string;
        department?: string;
        semester?: number;
        face_preview_url?: string;
    };
    summary: {
        overall_attendance_percentage: number;
        today_status: 'present' | 'absent' | 'holiday';
        shortage_warning: boolean;
        total_classes: number;
        present_count: number;
        late_count: number;
        absent_count: number;
    };
    subject_attendance: SubjectAttendanceRow[];
    calendar: CalendarDayStatus[];
    notifications: DashboardNotification[];
}

export interface FacultyDashboardData {
    role: 'faculty';
    threshold: number;
    summary: {
        today_label: string;
        today_class_count: number;
        total_students: number;
        present_count: number;
    };
    today_classes: Array<{
        course_id: number;
        course_code: string;
        course_name: string;
        time?: string;
    }>;
    live_attendance: {
        quick_action_route: string;
        recognized_students: Array<{
            attendance_id: number;
            student_id: string;
            student_name: string;
            course_code: string;
            status: 'present' | 'late' | 'absent';
            time: string;
        }>;
        unknown_face_alerts: number;
    };
    report_summary: {
        daily_attendance_rate: number;
        monthly_attendance_rate: number;
        shortage_records: number;
    };
}

export interface AdminDashboardData {
    role: 'admin';
    threshold: number;
    user_counts: {
        students: number;
        faculty: number;
        admins: number;
    };
    summary: {
        overall_attendance_percentage: number;
        total_records: number;
        total_students: number;
    };
    department_attendance: Array<{
        department: string;
        student_count: number;
        attendance_percentage: number;
    }>;
    top_performing_class: {
        course_id: number;
        course_code: string;
        course_name: string;
        attendance_percentage: number;
    } | null;
    attendance_trends: DailyTrend[];
    system_settings: {
        attendance_threshold: number;
        camera_mode: string;
        backup_enabled: boolean;
    };
}

export type DashboardData = StudentDashboardData | FacultyDashboardData | AdminDashboardData;

export interface StudentBulkUploadResult {
    total_rows: number;
    created: number;
    failed: number;
    errors: string[];
}

export interface TimetableBulkUploadResult {
    total_rows: number;
    inserted: number;
    failed: number;
    errors: string[];
}

export interface FacultyBulkUploadResult {
    total_rows: number;
    created: number;
    failed: number;
    errors: string[];
}

export interface CourseBulkUploadResult {
    total_rows: number;
    created: number;
    failed: number;
    errors: string[];
}

export interface DepartmentBulkUploadResult {
    total_rows: number;
    created: number;
    failed: number;
    errors: string[];
}

export interface ClassBulkUploadResult {
    total_rows: number;
    created: number;
    failed: number;
    errors: string[];
}

// Auth Types
export interface LoginCredentials {
    email: string;
    password: string;
}

export interface AuthToken {
    access_token: string;
    token_type: string;
}

// Form Types
export interface StudentFormData {
    student_id?: string;
    register_no: string;
    class_id: number;
    user_id?: number | null;
    full_name: string;
    email: string;
    department?: string;
    semester?: number;
}

export interface UserFormData {
    email: string;
    password: string;
    full_name: string;
    role: 'admin' | 'faculty' | 'student';
}
