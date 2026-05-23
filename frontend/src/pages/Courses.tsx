import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Edit, Trash2, Clock, Calendar, Search, Users } from 'lucide-react';
import { Card, Button, Input } from '../components/ui';
import { coursesApi } from '../services/endpoints';
import type { Course, CourseAssignment } from '../types';
import toast from 'react-hot-toast';

export const Courses: React.FC = () => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showAssignmentsModal, setShowAssignmentsModal] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
    const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        schedule: { days: [] as string[], time: '09:00' }
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadCourses();
    }, []);

    const loadCourses = async () => {
        setIsLoading(true);
        try {
            const data = await coursesApi.getAll();
            setCourses(data);
        } catch (error) {
            toast.error('Failed to load courses');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddCourse = async () => {
        if (!formData.code.trim() || !formData.name.trim()) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const newCourse = await coursesApi.create({
                code: formData.code.trim(),
                name: formData.name.trim(),
                schedule: formData.schedule
            });
            setCourses(prev => [...prev, newCourse]);
            setShowAddModal(false);
            resetForm();
            toast.success('Course created successfully!');
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Failed to create course');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditCourse = async () => {
        if (!selectedCourse) return;
        if (!formData.code.trim() || !formData.name.trim()) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const updatedCourse = await coursesApi.update(selectedCourse.id, {
                code: formData.code.trim(),
                name: formData.name.trim(),
                schedule: formData.schedule
            });
            setCourses(prev => prev.map(c => c.id === selectedCourse.id ? updatedCourse : c));
            setShowEditModal(false);
            setSelectedCourse(null);
            resetForm();
            toast.success('Course updated successfully!');
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Failed to update course');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCourse = async () => {
        if (!selectedCourse) return;

        setIsSubmitting(true);
        try {
            await coursesApi.delete(selectedCourse.id);
            setCourses(prev => prev.filter(c => c.id !== selectedCourse.id));
            setShowDeleteModal(false);
            setSelectedCourse(null);
            toast.success('Course deleted successfully!');
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Failed to delete course');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({ code: '', name: '', schedule: { days: [], time: '09:00' } });
    };

    const openEditModal = (course: Course) => {
        setSelectedCourse(course);
        setFormData({
            code: course.code,
            name: course.name,
            schedule: course.schedule || { days: [], time: '09:00' }
        });
        setShowEditModal(true);
    };

    const openDeleteModal = (course: Course) => {
        setSelectedCourse(course);
        setShowDeleteModal(true);
    };

    const openAssignmentsModal = async (course: Course) => {
        setSelectedCourse(course);
        setShowAssignmentsModal(true);
        setIsLoadingAssignments(true);
        try {
            const data = await coursesApi.getAssignments(course.id);
            setAssignments(data);
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to load assignments');
            setAssignments([]);
        } finally {
            setIsLoadingAssignments(false);
        }
    };

    const filteredCourses = courses.filter(course =>
        course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const toggleDay = (day: string) => {
        setFormData(prev => ({
            ...prev,
            schedule: {
                ...prev.schedule,
                days: prev.schedule.days.includes(day)
                    ? prev.schedule.days.filter(d => d !== day)
                    : [...prev.schedule.days, day]
            }
        }));
    };

    const renderCourseForm = (onSubmit: () => void, submitLabel: string) => (
        <div className="space-y-4">
            <Input
                label="Course Code"
                placeholder="e.g., CS101"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
            <Input
                label="Course Name"
                placeholder="e.g., Introduction to Computer Science"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Schedule Days</label>
                <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map(day => (
                        <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${formData.schedule.days.includes(day)
                                ? 'bg-primary-500 text-white'
                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                                }`}
                        >
                            {day}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Class Time</label>
                <input
                    type="time"
                    value={formData.schedule.time}
                    onChange={(e) => setFormData({ ...formData, schedule: { ...formData.schedule, time: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
            </div>
            <div className="flex gap-3 mt-6">
                <Button
                    variant="secondary"
                    onClick={() => {
                        setShowAddModal(false);
                        setShowEditModal(false);
                        resetForm();
                    }}
                    className="flex-1"
                >
                    Cancel
                </Button>
                <Button onClick={onSubmit} isLoading={isSubmitting} className="flex-1">
                    {submitLabel}
                </Button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BookOpen className="w-7 h-7 text-primary-400" />
                        Courses
                    </h1>
                    <p className="text-white/50">Manage your courses and class schedules</p>
                </div>
                <Button icon={Plus} onClick={() => setShowAddModal(true)}>
                    Add Course
                </Button>
            </div>

            {/* Search */}
            <Card className="p-4">
                <div className="flex gap-4">
                    <div className="flex-1">
                        <Input
                            placeholder="Search courses by name or code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            icon={Search}
                        />
                    </div>
                </div>
            </Card>

            {/* Courses Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    [...Array(6)].map((_, i) => (
                        <Card key={i} className="p-6">
                            <div className="animate-pulse space-y-4">
                                <div className="h-6 bg-white/10 rounded w-3/4" />
                                <div className="h-4 bg-white/10 rounded w-1/2" />
                                <div className="h-16 bg-white/10 rounded" />
                            </div>
                        </Card>
                    ))
                ) : filteredCourses.length === 0 ? (
                    <div className="col-span-full">
                        <Card className="p-12 text-center">
                            <BookOpen className="w-16 h-16 text-white/20 mx-auto mb-4" />
                            <p className="text-white/50 text-lg">
                                {searchQuery ? 'No courses match your search' : 'No courses yet'}
                            </p>
                            <p className="text-white/30 text-sm mt-2">
                                {searchQuery ? 'Try a different search term' : 'Create your first course to get started'}
                            </p>
                            {!searchQuery && (
                                <Button className="mt-4" icon={Plus} onClick={() => setShowAddModal(true)}>
                                    Add Course
                                </Button>
                            )}
                        </Card>
                    </div>
                ) : (
                    filteredCourses.map((course) => (
                        <Card key={course.id} className="p-6 hover:ring-2 hover:ring-primary-500/50 transition-all">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="text-sm text-primary-400 font-medium">{course.code}</p>
                                    <h3 className="text-lg font-semibold text-white">{course.name}</h3>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => openAssignmentsModal(course)}
                                        className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                        title="View assignments"
                                    >
                                        <Users className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => openEditModal(course)}
                                        className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => openDeleteModal(course)}
                                        className="p-2 text-white/50 hover:text-danger-400 hover:bg-danger-500/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3 text-sm">
                                {course.schedule?.days && course.schedule.days.length > 0 && (
                                    <div className="flex items-center gap-2 text-white/70">
                                        <Calendar className="w-4 h-4" />
                                        <span>{course.schedule.days.join(', ')}</span>
                                    </div>
                                )}
                                {course.schedule?.time && (
                                    <div className="flex items-center gap-2 text-white/70">
                                        <Clock className="w-4 h-4" />
                                        <span>{course.schedule.time}</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-sm">
                                <span className="text-white/50">Created</span>
                                <span className="text-white">
                                    {new Date(course.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Add Course Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
                    <div className="relative z-10 w-full max-w-md mx-4">
                        <Card className="p-6">
                            <h2 className="text-xl font-bold text-white mb-6">Add New Course</h2>
                            {renderCourseForm(handleAddCourse, 'Create Course')}
                        </Card>
                    </div>
                </div>
            )}

            {/* Edit Course Modal */}
            {showEditModal && selectedCourse && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
                    <div className="relative z-10 w-full max-w-md mx-4">
                        <Card className="p-6">
                            <h2 className="text-xl font-bold text-white mb-6">Edit Course</h2>
                            {renderCourseForm(handleEditCourse, 'Update Course')}
                        </Card>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && selectedCourse && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
                    <div className="relative z-10 w-full max-w-md mx-4">
                        <Card className="p-6">
                            <h2 className="text-xl font-bold text-white mb-4">Delete Course</h2>
                            <p className="text-white/70 mb-6">
                                Are you sure you want to delete <span className="text-white font-semibold">{selectedCourse.code} - {selectedCourse.name}</span>? This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button variant="danger" onClick={handleDeleteCourse} isLoading={isSubmitting} className="flex-1">
                                    Delete Course
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* Assignments Modal */}
            {showAssignmentsModal && selectedCourse && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAssignmentsModal(false)} />
                    <div className="relative z-10 w-full max-w-3xl mx-4">
                        <Card className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Course Assignments</h2>
                                    <p className="text-white/60 text-sm">
                                        {selectedCourse.code} - {selectedCourse.name}
                                    </p>
                                </div>
                                <Button variant="secondary" onClick={() => setShowAssignmentsModal(false)}>
                                    Close
                                </Button>
                            </div>

                            {isLoadingAssignments ? (
                                <p className="text-white/60">Loading assignments...</p>
                            ) : assignments.length === 0 ? (
                                <p className="text-white/60">No timetable assignments for this course yet.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-xs uppercase tracking-wider text-white/50 border-b border-white/10">
                                                <th className="py-3 pr-4">Class</th>
                                                <th className="py-3 pr-4">Faculty</th>
                                                <th className="py-3 pr-4">Day</th>
                                                <th className="py-3 pr-4">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {assignments.map((row, index) => (
                                                <tr key={`${row.class_id}-${row.faculty_id}-${row.day_of_week}-${index}`} className="border-b border-white/5">
                                                    <td className="py-3 pr-4 text-white">
                                                        {row.department_code} Y{row.year} {row.section}
                                                        <div className="text-xs text-white/50">{row.department_full_name}</div>
                                                    </td>
                                                    <td className="py-3 pr-4 text-white">
                                                        {row.faculty_name}
                                                        <div className="text-xs text-white/50">{row.faculty_email}</div>
                                                    </td>
                                                    <td className="py-3 pr-4 text-white/70">{row.day_of_week}</td>
                                                    <td className="py-3 pr-4 text-white/70">
                                                        {row.start_time} - {row.end_time}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};
