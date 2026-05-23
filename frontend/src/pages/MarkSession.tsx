import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, ScanFace } from 'lucide-react';
import toast from 'react-hot-toast';

import { Card, Badge, Input } from '../components/ui';
import { Camera } from '../components/camera';
import { sessionsApi } from '../services/endpoints';
import type { SessionMarkResponse } from '../types';

export const MarkSession: React.FC = () => {
    const [sessionCode, setSessionCode] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastResult, setLastResult] = useState<SessionMarkResponse | null>(null);
    const switchedRef = useRef(false);

    useEffect(() => {
        const onWindowBlur = () => {
            switchedRef.current = true;
        };
        const onVisibilityChange = () => {
            if (document.hidden) {
                switchedRef.current = true;
            }
        };

        const timerId = window.setTimeout(() => {
            switchedRef.current = true;
        }, 45000);

        window.addEventListener('blur', onWindowBlur);
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.clearTimeout(timerId);
            window.removeEventListener('blur', onWindowBlur);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);

    const getLocation = useCallback(async (): Promise<{ lat: number; lon: number }> => {
        if (!navigator.geolocation) {
            throw new Error('Location access is required to mark attendance');
        }

        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                    });
                },
                () => reject(new Error('Location access is required to mark attendance')),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        });
    }, []);

    const handleCapture = useCallback(
        async (imageBase64: string) => {
            if (switchedRef.current) {
                toast.error('Do not switch apps during attendance');
                return;
            }

            if (!sessionCode.trim() || sessionCode.trim().length !== 6) {
                toast.error('Enter valid 6-digit session code');
                return;
            }

            setIsProcessing(true);
            try {
                const { lat, lon } = await getLocation();
                const result = await sessionsApi.mark({
                    session_code: sessionCode.trim(),
                    image_base64: imageBase64,
                    lat,
                    lon,
                });
                setLastResult(result);
                if (result.success) {
                    toast.success(result.message);
                } else {
                    toast.error(result.message);
                }
            } catch (error: any) {
                const message =
                    error?.response?.data?.detail ||
                    error?.message ||
                    'Unable to mark attendance';
                toast.error(message);
                setLastResult({ success: false, message });
            } finally {
                setIsProcessing(false);
            }
        },
        [getLocation, sessionCode]
    );

    return (
        <div className="space-y-6 animate-in">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <ScanFace className="w-7 h-7 text-primary-300" />
                    Mark Session Attendance
                </h1>
                <p className="text-white/55">
                    Enter your 6-digit code, then take a selfie. Entry attendance is mandatory before hourly marks.
                </p>
            </div>

            <Card className="p-4 border border-warning-500/25 bg-warning-500/10">
                <p className="text-warning-200 text-sm font-medium">
                    Do not leave this screen while marking attendance.
                </p>
                <p className="text-warning-100/90 text-xs mt-1">
                    Location access is required to mark attendance.
                </p>
            </Card>

            <Card className="p-5">
                <div className="max-w-sm">
                    <Input
                        label="Session Code"
                        placeholder="123456"
                        value={sessionCode}
                        maxLength={6}
                        onChange={(event) => setSessionCode(event.target.value.replace(/\D/g, ''))}
                        icon={KeyRound}
                    />
                    <p className="text-xs text-white/45 mt-2">
                        Ask your faculty for the current session code.
                    </p>
                </div>
            </Card>

            <Card className="p-6">
                <Camera
                    onCapture={handleCapture}
                    isProcessing={isProcessing}
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

            {lastResult ? (
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-medium">{lastResult.message}</p>
                            {lastResult.session_type ? (
                                <p className="text-sm text-white/55 mt-1">
                                    Session Type: {lastResult.session_type.toUpperCase()}
                                </p>
                            ) : null}
                        </div>
                        <Badge variant={lastResult.success ? 'present' : 'absent'}>
                            {lastResult.success ? 'SUCCESS' : 'FAILED'}
                        </Badge>
                    </div>
                </Card>
            ) : null}
        </div>
    );
};
