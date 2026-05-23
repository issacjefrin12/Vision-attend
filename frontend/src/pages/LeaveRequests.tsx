import React, { useEffect, useState } from 'react';
import { CalendarRange, FilePlus2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, Badge, Button, Input } from '../components/ui';
import { leaveApi } from '../services/endpoints';
import type { LeaveRequest } from '../types';

const statusVariant = {
    pending: 'default',
    approved: 'present',
    rejected: 'absent',
} as const;

export const LeaveRequests: React.FC = () => {
    const [reason, setReason] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadRequests = async () => {
        setIsLoading(true);
        try {
            const data = await leaveApi.getMyRequests();
            setRequests(data);
        } catch {
            toast.error('Failed to load leave requests');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, []);

    const submitRequest = async () => {
        if (!reason.trim() || !fromDate || !toDate) {
            toast.error('Please fill all leave fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const created = await leaveApi.apply({
                reason: reason.trim(),
                from_date: fromDate,
                to_date: toDate,
            });
            setRequests((prev) => [created, ...prev]);
            setReason('');
            setFromDate('');
            setToDate('');
            toast.success('Leave request submitted');
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to submit leave request');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <CalendarRange className="w-7 h-7 text-primary-300" />
                    Leave Requests
                </h1>
                <p className="text-white/55">Apply for leave and track approval status.</p>
            </div>

            <Card className="p-5 space-y-4">
                <h2 className="text-lg text-white font-semibold flex items-center gap-2">
                    <FilePlus2 className="w-5 h-5 text-primary-300" />
                    Apply Leave
                </h2>
                <Input
                    label="Reason"
                    placeholder="Enter reason for leave"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">From Date</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(event) => setFromDate(event.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">To Date</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(event) => setToDate(event.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                </div>
                <Button onClick={submitRequest} isLoading={isSubmitting}>
                    Submit Leave Request
                </Button>
            </Card>

            <Card className="overflow-hidden">
                <div className="p-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white">My Requests</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-white/60 bg-white/5">
                                <th className="px-4 py-3">Submitted</th>
                                <th className="px-4 py-3">Reason</th>
                                <th className="px-4 py-3">Dates</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-white/55">Loading...</td>
                                </tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-white/55">No leave requests yet.</td>
                                </tr>
                            ) : (
                                requests.map((request) => (
                                    <tr key={request.id} className="border-t border-white/10">
                                        <td className="px-4 py-4 text-white/80">
                                            {new Date(request.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-4 text-white/80">{request.reason}</td>
                                        <td className="px-4 py-4 text-white/80">
                                            {request.from_date} to {request.to_date}
                                        </td>
                                        <td className="px-4 py-4">
                                            <Badge variant={statusVariant[request.status]}>
                                                {request.status.toUpperCase()}
                                            </Badge>
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
};

