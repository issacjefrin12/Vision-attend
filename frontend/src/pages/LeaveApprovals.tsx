import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, RefreshCcw, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, Badge, Button } from '../components/ui';
import { leaveApi } from '../services/endpoints';
import type { LeaveRequest } from '../types';

type LeaveStatus = 'pending' | 'approved' | 'rejected';

const badgeVariantByStatus: Record<LeaveStatus, 'default' | 'present' | 'absent'> = {
    pending: 'default',
    approved: 'present',
    rejected: 'absent',
};

export const LeaveApprovals: React.FC = () => {
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);

    const loadPending = async () => {
        setIsLoading(true);
        try {
            const data = await leaveApi.getPending();
            setRequests(data);
        } catch (error) {
            toast.error('Failed to load leave requests');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPending();
    }, []);

    const pendingCount = useMemo(
        () => requests.filter((request) => request.status === 'pending').length,
        [requests]
    );

    const applyDecision = async (requestId: number, status: 'approved' | 'rejected') => {
        setProcessingId(requestId);
        try {
            const updated =
                status === 'approved'
                    ? await leaveApi.approve(requestId)
                    : await leaveApi.reject(requestId);

            setRequests((previous) =>
                previous.map((request) =>
                    request.id === requestId ? updated : request
                )
            );
            toast.success(`Leave request ${status}`);
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Unable to update leave request');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ClipboardCheck className="w-7 h-7 text-primary-300" />
                        Leave Approval
                    </h1>
                    <p className="text-white/55">Approve or reject pending student leave requests.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" icon={RefreshCcw} onClick={loadPending}>
                        Refresh
                    </Button>
                    <Badge variant={pendingCount > 0 ? 'late' : 'present'}>
                        {pendingCount} pending
                    </Badge>
                </div>
            </div>

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-white/60 bg-white/5">
                                <th className="px-4 py-3">Student</th>
                                <th className="px-4 py-3">Reason</th>
                                <th className="px-4 py-3">Dates</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                [...Array(3)].map((_, index) => (
                                    <tr key={index} className="border-t border-white/10">
                                        <td colSpan={5} className="p-4">
                                            <div className="h-10 rounded-lg bg-white/10 animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-10 text-center text-white/55">
                                        No leave requests found.
                                    </td>
                                </tr>
                            ) : (
                                requests.map((request) => (
                                    <tr key={request.id} className="border-t border-white/10">
                                        <td className="px-4 py-4">
                                            <p className="text-white font-medium">{request.student_name}</p>
                                            <p className="text-xs text-white/50">{request.register_number}</p>
                                        </td>
                                        <td className="px-4 py-4 text-white/80">{request.reason}</td>
                                        <td className="px-4 py-4 text-white/80">
                                            {request.from_date} to {request.to_date}
                                        </td>
                                        <td className="px-4 py-4">
                                            <Badge variant={badgeVariantByStatus[request.status]}>
                                                {request.status.toUpperCase()}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    icon={CheckCircle2}
                                                    onClick={() => applyDecision(request.id, 'approved')}
                                                    disabled={request.status !== 'pending' || processingId === request.id}
                                                >
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    icon={XCircle}
                                                    onClick={() => applyDecision(request.id, 'rejected')}
                                                    disabled={request.status !== 'pending' || processingId === request.id}
                                                >
                                                    Reject
                                                </Button>
                                            </div>
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

