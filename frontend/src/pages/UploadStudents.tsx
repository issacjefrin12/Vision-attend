import React, { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button, Card } from '../components/ui';
import { adminApi } from '../services/endpoints';
import type { StudentBulkUploadResult } from '../types';

export const UploadStudents: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<StudentBulkUploadResult | null>(null);

    const handleDownloadTemplate = async () => {
        setIsDownloading(true);
        try {
            const blob = await adminApi.downloadStudentsTemplate();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'students_template.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Template downloaded');
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to download template');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error('Select a CSV file first');
            return;
        }
        setIsUploading(true);
        try {
            const data = await adminApi.uploadStudentsCsv(file);
            setResult(data);
            toast.success('Upload finished');
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold text-white">Upload Students</h1>
                <p className="text-white/60 text-sm">Admin bulk upload for student records.</p>
            </div>

            <Card className="p-6 space-y-4">
                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="secondary"
                        icon={Download}
                        onClick={handleDownloadTemplate}
                        isLoading={isDownloading}
                    >
                        Download Template
                    </Button>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm text-white/80">Upload CSV</label>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={(event) => setFile(event.target.files?.[0] || null)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
                    />
                    <p className="text-xs text-white/50">
                        Required columns: register_no, name, email, department_code, year, section
                    </p>
                    {file && <p className="text-sm text-white/70">Selected: {file.name}</p>}
                </div>

                <Button icon={Upload} onClick={handleUpload} isLoading={isUploading}>
                    Submit Upload
                </Button>
            </Card>

            {result && (
                <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Result Summary</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div className="bg-white/5 rounded-lg p-3 text-white">Total rows: {result.total_rows}</div>
                        <div className="bg-white/5 rounded-lg p-3 text-white">Success count: {result.created}</div>
                        <div className="bg-white/5 rounded-lg p-3 text-white">Failed count: {result.failed}</div>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-white mb-2">Errors</p>
                        {result.errors.length === 0 ? (
                            <p className="text-sm text-success-400">No errors</p>
                        ) : (
                            <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3">
                                <ul className="space-y-1 text-sm text-danger-300">
                                    {result.errors.map((error, index) => (
                                        <li key={`${index}-${error}`}>{error}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
};
