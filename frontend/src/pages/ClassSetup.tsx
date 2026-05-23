import React, { useEffect, useState } from 'react';
import { Building2, MapPin, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { Button, Card, Input } from '../components/ui';
import { academicsApi } from '../services/endpoints';
import type { AcademicClass, Department } from '../types';

export const ClassSetup: React.FC = () => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [classes, setClasses] = useState<AcademicClass[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmittingDepartment, setIsSubmittingDepartment] = useState(false);
    const [isSubmittingClass, setIsSubmittingClass] = useState(false);
    const [deletingClassId, setDeletingClassId] = useState<number | null>(null);

    const [departmentCode, setDepartmentCode] = useState('');
    const [departmentFullName, setDepartmentFullName] = useState('');
    const [classForm, setClassForm] = useState({
        department_code: '',
        year: 1,
        section: '',
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [departmentRows, classRows] = await Promise.all([
                academicsApi.listDepartments(),
                academicsApi.listClasses(),
            ]);
            setDepartments(departmentRows);
            setClasses(classRows);
            if (departmentRows.length > 0) {
                setClassForm((prev) => ({
                    ...prev,
                    department_code: prev.department_code || departmentRows[0].code,
                }));
            }
        } catch (error) {
            toast.error('Failed to load class setup data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreateDepartment = async (event: React.FormEvent) => {
        event.preventDefault();
        const code = departmentCode.trim().toUpperCase();
        const full_name = departmentFullName.trim();
        if (!code || !full_name) {
            toast.error('Enter department code and full name');
            return;
        }

        setIsSubmittingDepartment(true);
        try {
            await academicsApi.createDepartment({ code, full_name });
            setDepartmentCode('');
            setDepartmentFullName('');
            toast.success('Department created');
            await loadData();
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to create department');
        } finally {
            setIsSubmittingDepartment(false);
        }
    };

    const handleCreateClass = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!classForm.department_code.trim()) {
            toast.error('Select department');
            return;
        }
        if (!classForm.section.trim()) {
            toast.error('Enter section');
            return;
        }

        setIsSubmittingClass(true);
        try {
            await academicsApi.createClass({
                department_code: classForm.department_code.trim().toUpperCase(),
                year: classForm.year,
                section: classForm.section.trim(),
            });
            setClassForm((prev) => ({ ...prev, section: '' }));
            toast.success('Class created');
            await loadData();
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to create class');
        } finally {
            setIsSubmittingClass(false);
        }
    };

    const handleDeleteClass = async (classRow: AcademicClass) => {
        const confirmed = window.confirm(
            `Delete class ${classRow.department_code} - Year ${classRow.year} Sec ${classRow.section}?`
        );
        if (!confirmed) return;

        setDeletingClassId(classRow.id);
        try {
            await academicsApi.deleteClass(classRow.id);
            toast.success('Class deleted');
            await loadData();
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to delete class');
        } finally {
            setDeletingClassId(null);
        }
    };

    return (
        <div className="space-y-6 animate-in max-w-5xl">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Building2 className="w-7 h-7 text-primary-400" />
                    Class Setup
                </h1>
                <p className="text-white/50">Admin creates year/section classes and manages departments.</p>
                <div className="mt-3">
                    <Link to="/class-location">
                        <Button icon={MapPin} size="sm">Set Class Location</Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Manual Add Department</h2>
                    <form onSubmit={handleCreateDepartment} className="space-y-4">
                        <Input
                            label="Department Code"
                            value={departmentCode}
                            onChange={(e) => setDepartmentCode(e.target.value.toUpperCase())}
                            placeholder="e.g., CSE"
                        />
                        <Input
                            label="Full Name"
                            value={departmentFullName}
                            onChange={(e) => setDepartmentFullName(e.target.value)}
                            placeholder="e.g., Computer Science and Engineering"
                        />
                        <Button type="submit" icon={Plus} isLoading={isSubmittingDepartment}>
                            Add Department
                        </Button>
                    </form>
                </Card>

                <Card className="p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Create Class (Year + Section)</h2>
                    <form onSubmit={handleCreateClass} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Department</label>
                            <select
                                value={classForm.department_code || ''}
                                onChange={(e) =>
                                    setClassForm({ ...classForm, department_code: e.target.value })
                                }
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white"
                            >
                                <option value="">Select Department</option>
                                {departments.map((department) => (
                                    <option key={department.id} value={department.code}>
                                        {department.code} - {department.full_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Input
                            type="number"
                            min={1}
                            max={6}
                            label="Year"
                            value={classForm.year}
                            onChange={(e) =>
                                setClassForm({ ...classForm, year: Number(e.target.value) || 1 })
                            }
                        />
                        <Input
                            label="Section"
                            value={classForm.section}
                            onChange={(e) => setClassForm({ ...classForm, section: e.target.value })}
                            placeholder="e.g., A1"
                        />
                        <Button type="submit" icon={Plus} isLoading={isSubmittingClass}>
                            Add Class
                        </Button>
                    </form>
                </Card>
            </div>

            <Card className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Current Classes</h2>
                {isLoading ? (
                    <p className="text-white/60">Loading...</p>
                ) : classes.length === 0 ? (
                    <p className="text-white/60">No classes created yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wider text-white/50 border-b border-white/10">
                                    <th className="py-3 pr-4">Department Code</th>
                                    <th className="py-3 pr-4">Department Name</th>
                                    <th className="py-3 pr-4">Year</th>
                                    <th className="py-3 pr-4">Section</th>
                                    <th className="py-3 pr-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {classes.map((classRow) => (
                                    <tr key={classRow.id} className="border-b border-white/5">
                                        <td className="py-3 pr-4 text-white">{classRow.department_code}</td>
                                        <td className="py-3 pr-4 text-white/75">{classRow.department_full_name}</td>
                                        <td className="py-3 pr-4 text-white">{classRow.year}</td>
                                        <td className="py-3 pr-4 text-white">{classRow.section}</td>
                                        <td className="py-3 pr-4 text-right">
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                icon={Trash2}
                                                isLoading={deletingClassId === classRow.id}
                                                onClick={() => handleDeleteClass(classRow)}
                                            >
                                                Delete
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};
