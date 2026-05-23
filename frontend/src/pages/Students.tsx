import React, { useEffect, useState } from 'react';
import {
    Users, Plus, Search, Filter, Download,
    Mail, Scan, UserCheck, Trash2, Edit, X, ArrowRight, AlertTriangle
} from 'lucide-react';
import { Button, Card, Badge, Input } from '../components/ui';
import { Camera } from '../components/camera';
import { academicsApi, studentsApi } from '../services/endpoints';
import type { AcademicClass, Student, StudentFormData } from '../types';
import toast from 'react-hot-toast';

export const Students: React.FC = () => {
    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<AcademicClass[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Add/Edit Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modalStep, setModalStep] = useState<1 | 2>(1);
    const [createdStudentId, setCreatedStudentId] = useState<number | null>(null);
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [enrollResult, setEnrollResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);
    const [formData, setFormData] = useState<StudentFormData>({
        student_id: '',
        register_no: '',
        class_id: 0,
        full_name: '',
        email: '',
        department: '',
        semester: undefined,
    });

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);

    // Enroll Face Modal State
    const [showEnrollModal, setShowEnrollModal] = useState(false);
    const [enrollingStudent, setEnrollingStudent] = useState<Student | null>(null);

    // Delete Confirmation State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Filter State
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filterDepartment, setFilterDepartment] = useState('');
    const [filterSemester, setFilterSemester] = useState('');
    const [filterEnrolled, setFilterEnrolled] = useState<'all' | 'enrolled' | 'pending'>('all');
    const getSafeText = (value: unknown, fallback = ''): string => {
        if (typeof value !== 'string') return fallback;
        const trimmed = value.trim();
        return trimmed || fallback;
    };
    const getApiErrorMessage = (error: any, fallback: string): string => {
        const detail = error?.response?.data?.detail;
        if (typeof detail === 'string') return detail;
        if (Array.isArray(detail)) {
            const parsed = detail
                .map((item) => {
                    if (typeof item === 'string') return item;
                    if (item && typeof item === 'object' && typeof item.msg === 'string') return item.msg;
                    return null;
                })
                .filter(Boolean);
            if (parsed.length > 0) return parsed.join(', ');
        }
        if (detail && typeof detail === 'object') return JSON.stringify(detail);
        return fallback;
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const [studentRows, classRows] = await Promise.all([
                studentsApi.getAll(),
                academicsApi.listClasses(),
            ]);
            setStudents(studentRows);
            setClasses(classRows);
            if (classRows.length > 0) {
                setFormData((prev) => ({
                    ...prev,
                    class_id: prev.class_id || classRows[0].id,
                }));
            }
        } catch (error) {
            toast.error('Failed to load students');
        } finally {
            setIsLoading(false);
        }
    };

    const loadStudents = async () => {
        try {
            const data = await studentsApi.getAll();
            setStudents(data);
        } catch (error) {
            toast.error('Failed to load students');
        }
    };

    // ===== ADD STUDENT HANDLERS =====
    const resetAddModal = () => {
        setShowAddModal(false);
        setModalStep(1);
        setCreatedStudentId(null);
        setEnrollResult(null);
        setFormData({
            student_id: '',
            register_no: '',
            class_id: classes[0]?.id || 0,
            full_name: '',
            email: '',
            department: '',
            semester: undefined,
        });
    };

    const handleCreateStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.class_id) {
            toast.error('Select class');
            return;
        }
        setIsSubmitting(true);

        try {
            const payload: StudentFormData = {
                class_id: formData.class_id,
                register_no: formData.register_no.trim(),
                full_name: formData.full_name.trim(),
                email: formData.email.trim(),
                department: getSafeText(formData.department) || undefined,
                semester: formData.semester,
                ...(getSafeText(formData.student_id) ? { student_id: getSafeText(formData.student_id) } : {}),
            };

            const newStudent = await studentsApi.create(payload);
            setCreatedStudentId(newStudent.id);
            toast.success('Student created! Now capture face for enrollment.');
            setModalStep(2);
        } catch (error: any) {
            toast.error(getApiErrorMessage(error, 'Failed to add student'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFaceCapture = async (imageBase64: string) => {
        if (!createdStudentId) return;

        setIsEnrolling(true);
        setEnrollResult(null);

        try {
            const result = await studentsApi.enrollFace(createdStudentId, imageBase64);
            setEnrollResult({
                success: result.success,
                message: result.message,
            });

            if (result.success) {
                toast.success('Face enrolled successfully!');
                loadStudents();
                setTimeout(() => {
                    resetAddModal();
                }, 1500);
            }
        } catch (error: any) {
            setEnrollResult({
                success: false,
                message: getApiErrorMessage(error, 'Failed to enroll face'),
            });
            toast.error('Face enrollment failed');
        } finally {
            setIsEnrolling(false);
        }
    };

    const handleSkipEnrollment = () => {
        toast.success('Student added! You can enroll face later.');
        loadStudents();
        resetAddModal();
    };

    // ===== EDIT STUDENT HANDLERS =====
    const openEditModal = (student: Student) => {
        setEditingStudent(student);
        setFormData({
            student_id: getSafeText(student.student_id),
            register_no: getSafeText(student.register_no) || getSafeText(student.student_id),
            class_id: student.class_id || classes[0]?.id || 0,
            full_name: getSafeText(student.full_name),
            email: getSafeText(student.email),
            department: getSafeText(student.department),
            semester: student.semester,
        });
        setShowEditModal(true);
    };

    const handleUpdateStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingStudent) return;
        if (!formData.class_id) {
            toast.error('Select class');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: Partial<StudentFormData> = {
                class_id: formData.class_id,
                register_no: formData.register_no.trim(),
                full_name: formData.full_name.trim(),
                email: formData.email.trim(),
                department: getSafeText(formData.department) || undefined,
                semester: formData.semester,
                ...(getSafeText(formData.student_id) ? { student_id: getSafeText(formData.student_id) } : {}),
            };
            await studentsApi.update(editingStudent.id, payload);
            toast.success('Student updated successfully!');
            setShowEditModal(false);
            setEditingStudent(null);
            setFormData({
                student_id: '',
                register_no: '',
                class_id: classes[0]?.id || 0,
                full_name: '',
                email: '',
                department: '',
                semester: undefined,
            });
            loadStudents();
        } catch (error: any) {
            toast.error(getApiErrorMessage(error, 'Failed to update student'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // ===== DELETE STUDENT HANDLERS =====
    const openDeleteModal = (student: Student) => {
        setDeletingStudent(student);
        setShowDeleteModal(true);
    };

    const handleDeleteStudent = async () => {
        if (!deletingStudent) return;

        setIsDeleting(true);
        try {
            await studentsApi.delete(deletingStudent.id);
            toast.success('Student deleted successfully!');
            setShowDeleteModal(false);
            setDeletingStudent(null);
            loadStudents();
        } catch (error: any) {
            toast.error(getApiErrorMessage(error, 'Failed to delete student'));
        } finally {
            setIsDeleting(false);
        }
    };

    // ===== ENROLL FACE HANDLERS =====
    const openEnrollModal = (student: Student) => {
        setEnrollingStudent(student);
        setEnrollResult(null);
        setShowEnrollModal(true);
    };

    const handleEnrollFaceCapture = async (imageBase64: string) => {
        if (!enrollingStudent) return;

        setIsEnrolling(true);
        setEnrollResult(null);

        try {
            const result = await studentsApi.enrollFace(enrollingStudent.id, imageBase64);
            setEnrollResult({
                success: result.success,
                message: result.message,
            });

            if (result.success) {
                toast.success('Face enrolled successfully!');
                loadStudents();
                setTimeout(() => {
                    setShowEnrollModal(false);
                    setEnrollingStudent(null);
                }, 1500);
            }
        } catch (error: any) {
            setEnrollResult({
                success: false,
                message: getApiErrorMessage(error, 'Failed to enroll face'),
            });
            toast.error('Face enrollment failed');
        } finally {
            setIsEnrolling(false);
        }
    };

    // ===== EXPORT HANDLER =====
    const handleExport = () => {
        // Create CSV content
        const headers = ['Register No', 'Full Name', 'Email', 'Class', 'Department', 'Semester', 'Face Enrolled'];
        const rows = filteredStudents.map(s => [
            getSafeText(s.register_no) || getSafeText(s.student_id) || 'N/A',
            getSafeText(s.full_name) || 'N/A',
            getSafeText(s.email) || 'N/A',
            s.class_id ? getClassLabel(s.class_id) : '',
            getSafeText(s.department),
            s.semester?.toString() || '',
            s.face_encoding_path ? 'Yes' : 'No'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `students_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        toast.success('Students exported successfully!');
    };

    // ===== FILTER LOGIC =====
    const applyFilters = () => {
        setShowFilterModal(false);
        toast.success('Filters applied!');
    };

    const clearFilters = () => {
        setFilterDepartment('');
        setFilterSemester('');
        setFilterEnrolled('all');
        setShowFilterModal(false);
        toast.success('Filters cleared!');
    };

    // Get unique departments for filter dropdown
    const uniqueDepartments = [...new Set(students.map(s => getSafeText(s.department)).filter(Boolean))];
    const getClassLabel = (id: number): string => {
        const classRow = classes.find((item) => item.id === id);
        if (!classRow) return `Class ${id}`;
        return `${classRow.department_name} Y${classRow.year}${classRow.section}`;
    };

    const filteredStudents = students.filter(student => {
        const search = searchQuery.toLowerCase();
        const fullName = getSafeText(student.full_name).toLowerCase();
        const registerNumber = (getSafeText(student.register_no) || getSafeText(student.student_id)).toLowerCase();
        const email = getSafeText(student.email).toLowerCase();

        // Search filter
        const matchesSearch =
            fullName.includes(search) ||
            registerNumber.includes(search) ||
            email.includes(search);

        // Department filter
        const matchesDepartment = !filterDepartment || getSafeText(student.department) === filterDepartment;

        // Semester filter
        const matchesSemester = !filterSemester || student.semester?.toString() === filterSemester;

        // Enrolled filter
        const matchesEnrolled =
            filterEnrolled === 'all' ||
            (filterEnrolled === 'enrolled' && student.face_encoding_path) ||
            (filterEnrolled === 'pending' && !student.face_encoding_path);

        return matchesSearch && matchesDepartment && matchesSemester && matchesEnrolled;
    });

    return (
        <div className="space-y-6 animate-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Users className="w-7 h-7 text-primary-400" />
                        Students
                    </h1>
                    <p className="text-white/50">Manage student records and face enrollments</p>
                </div>
                <Button icon={Plus} onClick={() => setShowAddModal(true)}>
                    Add Student
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-primary-500/20 rounded-xl">
                        <Users className="w-6 h-6 text-primary-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">{students.length}</p>
                        <p className="text-sm text-white/50">Total Students</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-success-500/20 rounded-xl">
                        <Scan className="w-6 h-6 text-success-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">
                            {students.filter(s => s.face_encoding_path).length}
                        </p>
                        <p className="text-sm text-white/50">Faces Enrolled</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-warning-500/20 rounded-xl">
                        <UserCheck className="w-6 h-6 text-warning-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">
                            {students.filter(s => !s.face_encoding_path).length}
                        </p>
                        <p className="text-sm text-white/50">Pending Enrollment</p>
                    </div>
                </Card>
            </div>

            {/* Filters & Search */}
            <Card className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            placeholder="Search students..."
                            icon={Search}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            icon={Filter}
                            onClick={() => setShowFilterModal(true)}
                        >
                            Filter
                            {(filterDepartment || filterSemester || filterEnrolled !== 'all') && (
                                <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-500 rounded-full">
                                    {[filterDepartment, filterSemester, filterEnrolled !== 'all' ? '1' : ''].filter(Boolean).length}
                                </span>
                            )}
                        </Button>
                        <Button
                            variant="secondary"
                            icon={Download}
                            onClick={handleExport}
                        >
                            Export
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Students Table */}
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-white/5 text-white/70 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 text-left">Student</th>
                                <th className="px-6 py-4 text-left">Reg No</th>
                                <th className="px-6 py-4 text-left">Class</th>
                                <th className="px-6 py-4 text-left">Department</th>
                                <th className="px-6 py-4 text-left">Semester</th>
                                <th className="px-6 py-4 text-left">Face Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="border-b border-white/5">
                                        <td colSpan={7} className="p-4">
                                            <div className="h-12 bg-white/5 rounded animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12">
                                        <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                        <p className="text-white/50">No students found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((student) => (
                                    <tr
                                        key={student.id}
                                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                                                    <span className="text-white font-semibold">
                                                        {(getSafeText(student.full_name).charAt(0) || 'S').toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{getSafeText(student.full_name) || 'Unknown Student'}</p>
                                                    <p className="text-sm text-white/50 flex items-center gap-1">
                                                        <Mail className="w-3 h-3" />
                                                        {getSafeText(student.email) || 'No email'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-sm text-primary-400 bg-primary-500/10 px-2 py-1 rounded">
                                                {getSafeText(student.register_no) || getSafeText(student.student_id) || 'N/A'}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4 text-white/70">
                                            {student.class_id ? getClassLabel(student.class_id) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-white/70">
                                            {getSafeText(student.department) || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-white/70">
                                            {student.semester || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {student.face_encoding_path ? (
                                                <Badge variant="present">Enrolled</Badge>
                                            ) : (
                                                <Badge variant="absent">Pending</Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEnrollModal(student)}
                                                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                    title={student.face_encoding_path ? "Re-enroll Face" : "Enroll Face"}
                                                >
                                                    <Scan className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(student)}
                                                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openDeleteModal(student)}
                                                    className="p-2 text-white/50 hover:text-danger-400 hover:bg-danger-500/10 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
                    <p className="text-sm text-white/50">
                        Showing {filteredStudents.length} of {students.length} students
                    </p>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" disabled>Previous</Button>
                        <Button variant="ghost" size="sm" disabled>Next</Button>
                    </div>
                </div>
            </Card>

            {/* ===== ADD STUDENT MODAL ===== */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={resetAddModal}
                    />
                    <div className="relative z-10 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                        <Card className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        {modalStep === 1 ? 'Add New Student' : 'Enroll Face'}
                                    </h2>
                                    <p className="text-white/50 text-sm mt-1">
                                        Step {modalStep} of 2: {modalStep === 1 ? 'Enter details' : 'Capture face'}
                                    </p>
                                </div>
                                <button
                                    onClick={resetAddModal}
                                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex items-center gap-3 mb-6">
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${modalStep >= 1 ? 'bg-primary-500 text-white' : 'bg-white/10 text-white/50'}`}>
                                    1
                                </div>
                                <div className={`flex-1 h-1 rounded ${modalStep >= 2 ? 'bg-primary-500' : 'bg-white/10'}`} />
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${modalStep >= 2 ? 'bg-primary-500 text-white' : 'bg-white/10 text-white/50'}`}>
                                    2
                                </div>
                            </div>

                            {modalStep === 1 && (
                                <form onSubmit={handleCreateStudent} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Input
                                            label="Register Number"
                                            placeholder="e.g., 23CSE001"
                                            value={formData.register_no}
                                            onChange={(e) => setFormData({ ...formData, register_no: e.target.value })}
                                            required
                                        />
                                        <Input
                                            label="Full Name"
                                            placeholder="Enter student's full name"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <Input
                                        type="email"
                                        label="Email"
                                        placeholder="student@example.com"
                                        icon={Mail}
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                    />
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">Class</label>
                                        <select
                                            value={formData.class_id || ''}
                                            onChange={(e) => setFormData({ ...formData, class_id: Number(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            required
                                        >
                                            {classes.map((classRow) => (
                                                <option key={classRow.id} value={classRow.id}>
                                                    {classRow.department_name} - Year {classRow.year} Sec {classRow.section}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={resetAddModal}
                                            className="flex-1"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            isLoading={isSubmitting}
                                            icon={ArrowRight}
                                            iconPosition="right"
                                            className="flex-1"
                                        >
                                            Next: Capture Face
                                        </Button>
                                    </div>
                                </form>
                            )}

                            {modalStep === 2 && (
                                <div className="space-y-4">
                                    <div className="text-center mb-4">
                                        <p className="text-white/70">
                                            Capturing face for: <span className="text-white font-semibold">{formData.full_name}</span>
                                        </p>
                                    </div>

                                    <Camera
                                        onCapture={handleFaceCapture}
                                        isProcessing={isEnrolling}
                                        lastResult={enrollResult}
                                        mode="enroll"
                                        autoStart
                                    />

                                    <div className="flex gap-3 pt-4">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={handleSkipEnrollment}
                                            className="flex-1"
                                        >
                                            Skip for Now
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={resetAddModal}
                                            className="flex-1"
                                        >
                                            Done
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}

            {/* ===== EDIT STUDENT MODAL ===== */}
            {showEditModal && editingStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowEditModal(false)}
                    />
                    <div className="relative z-10 w-full max-w-md mx-4">
                        <Card className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">Edit Student</h2>
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleUpdateStudent} className="space-y-4">
                                <Input
                                    label="Register Number"
                                    placeholder="e.g., 23CSE001"
                                    value={formData.register_no}
                                    onChange={(e) => setFormData({ ...formData, register_no: e.target.value })}
                                    required
                                />
                                <Input
                                    label="Full Name"
                                    placeholder="Enter student's full name"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    required
                                />
                                <Input
                                    type="email"
                                    label="Email"
                                    placeholder="student@example.com"
                                    icon={Mail}
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                                <div>
                                    <label className="block text-sm font-medium text-white/70 mb-2">Class</label>
                                    <select
                                        value={formData.class_id || ''}
                                        onChange={(e) => setFormData({ ...formData, class_id: Number(e.target.value) })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        required
                                    >
                                        {classes.map((classRow) => (
                                            <option key={classRow.id} value={classRow.id}>
                                                {classRow.department_name} - Year {classRow.year} Sec {classRow.section}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => setShowEditModal(false)}
                                        className="flex-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        isLoading={isSubmitting}
                                        className="flex-1"
                                    >
                                        Save Changes
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    </div>
                </div>
            )}

            {/* ===== ENROLL FACE MODAL ===== */}
            {showEnrollModal && enrollingStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowEnrollModal(false)}
                    />
                    <div className="relative z-10 w-full max-w-2xl mx-4">
                        <Card className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        {enrollingStudent.face_encoding_path ? 'Re-enroll Face' : 'Enroll Face'}
                                    </h2>
                                    <p className="text-white/70 text-sm mt-1">
                                        For: <span className="text-white font-semibold">{enrollingStudent.full_name}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowEnrollModal(false)}
                                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <Camera
                                onCapture={handleEnrollFaceCapture}
                                isProcessing={isEnrolling}
                                lastResult={enrollResult}
                                mode="enroll"
                                autoStart
                            />

                            <div className="flex gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setShowEnrollModal(false)}
                                    className="flex-1"
                                >
                                    Close
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* ===== DELETE CONFIRMATION MODAL ===== */}
            {showDeleteModal && deletingStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowDeleteModal(false)}
                    />
                    <div className="relative z-10 w-full max-w-sm mx-4">
                        <Card className="p-6">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 rounded-full bg-danger-500/20 flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="w-8 h-8 text-danger-400" />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">Delete Student?</h2>
                                <p className="text-white/60">
                                    Are you sure you want to delete <span className="text-white font-semibold">{deletingStudent.full_name}</span>?
                                    This action cannot be undone.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    variant="danger"
                                    onClick={handleDeleteStudent}
                                    isLoading={isDeleting}
                                    icon={Trash2}
                                    className="flex-1"
                                >
                                    Delete
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* ===== FILTER MODAL ===== */}
            {showFilterModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowFilterModal(false)}
                    />
                    <div className="relative z-10 w-full max-w-sm mx-4">
                        <Card className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">Filter Students</h2>
                                <button
                                    onClick={() => setShowFilterModal(false)}
                                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-white/70 mb-2">Department</label>
                                    <select
                                        value={filterDepartment}
                                        onChange={(e) => setFilterDepartment(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    >
                                        <option value="">All Departments</option>
                                        {uniqueDepartments.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>

                                <Input
                                    label="Semester"
                                    type="number"
                                    placeholder="e.g., 4"
                                    value={filterSemester}
                                    onChange={(e) => setFilterSemester(e.target.value)}
                                />

                                <div>
                                    <label className="block text-sm font-medium text-white/70 mb-2">Face Enrollment</label>
                                    <select
                                        value={filterEnrolled}
                                        onChange={(e) => setFilterEnrolled(e.target.value as any)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    >
                                        <option value="all">All Students</option>
                                        <option value="enrolled">Enrolled Only</option>
                                        <option value="pending">Pending Only</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-6">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={clearFilters}
                                    className="flex-1"
                                >
                                    Clear
                                </Button>
                                <Button
                                    type="button"
                                    onClick={applyFilters}
                                    className="flex-1"
                                >
                                    Apply Filters
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};
