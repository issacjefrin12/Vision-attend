import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Camera as CameraIcon, Video, VideoOff, Loader2, CheckCircle, XCircle, User } from 'lucide-react';
import { Button } from '../ui';

interface CameraProps {
    onCapture: (imageBase64: string) => void;
    isProcessing?: boolean;
    lastResult?: {
        success: boolean;
        message: string;
        studentName?: string;
        confidence?: number;
    } | null;
    mode?: 'attendance' | 'enroll';
    autoStart?: boolean;
}

export const Camera: React.FC<CameraProps> = ({
    onCapture,
    isProcessing = false,
    lastResult = null,
    mode = 'attendance',
    autoStart = false,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hasTriedAutoStartRef = useRef(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startCamera = useCallback(async () => {
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                setError('Camera is unavailable in this browser/context. Use HTTPS or localhost.');
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user',
                },
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play().catch(() => null);
                setIsStreaming(true);
                setError(null);
            }
        } catch (err: any) {
            if (err?.name === 'NotAllowedError') {
                setError('Camera access denied. Allow camera permission and use HTTPS if opening from another device.');
            } else if (err?.name === 'NotFoundError') {
                setError('No camera device detected on this device.');
            } else {
                setError('Failed to access camera. Please allow camera permissions.');
            }
            console.error('Camera error:', err);
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setIsStreaming(false);
        }
    }, []);

    const captureFrame = useCallback((): string | null => {
        if (!videoRef.current || !canvasRef.current) return null;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx) return null;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        return canvas.toDataURL('image/jpeg', 0.9);
    }, []);

    const captureImage = useCallback(async () => {
        if (isProcessing) return;
        setError(null);

        const imageBase64 = captureFrame();
        if (!imageBase64) {
            setError('Unable to capture image from camera.');
            return;
        }
        onCapture(imageBase64);
    }, [isProcessing, captureFrame, onCapture]);

    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    useEffect(() => {
        if (!autoStart || isStreaming || hasTriedAutoStartRef.current) return;
        hasTriedAutoStartRef.current = true;
        startCamera();
    }, [autoStart, isStreaming, startCamera]);

    return (
        <div className="space-y-4">
            {/* Camera viewport */}
            <div className="camera-container relative rounded-2xl overflow-hidden bg-slate-900 aspect-video min-h-[240px]">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isStreaming ? 'block' : 'hidden'}`}
                />

                <canvas ref={canvasRef} className="hidden" />

                {/* Overlay states */}
                {!isStreaming && !error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                        <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-4">
                            <CameraIcon className="w-12 h-12 text-white/50" />
                        </div>
                        <p className="text-white/60 mb-4">Camera is not active</p>
                        <Button onClick={startCamera} icon={Video}>
                            Start Camera
                        </Button>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                        <div className="w-24 h-24 rounded-full bg-danger-500/20 flex items-center justify-center mb-4">
                            <VideoOff className="w-12 h-12 text-danger-400" />
                        </div>
                        <p className="text-danger-400 text-center px-4 mb-4">{error}</p>
                        <Button
                            onClick={() => {
                                setError(null);
                                startCamera();
                            }}
                            icon={Video}
                        >
                            Retry Camera
                        </Button>
                    </div>
                )}

                {/* Processing overlay */}
                {isProcessing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                        <div className="text-center">
                            <Loader2 className="w-16 h-16 text-primary-400 animate-spin mx-auto mb-4" />
                            <p className="text-white font-medium">
                                {mode === 'attendance' ? 'Recognizing face...' : 'Enrolling face...'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Face detection guide */}
                {isStreaming && !isProcessing && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 border-primary-500/50 rounded-[100px] animate-pulse">
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs text-primary-400 whitespace-nowrap">
                                Position face here
                            </div>
                        </div>
                    </div>
                )}

                {/* Result overlay */}
                {lastResult && !isProcessing && (
                    <div className={`absolute bottom-0 left-0 right-0 p-4 ${lastResult.success
                            ? 'bg-gradient-to-t from-success-500/80 to-transparent'
                            : 'bg-gradient-to-t from-danger-500/80 to-transparent'
                        }`}>
                        <div className="flex items-center gap-3">
                            {lastResult.success ? (
                                <CheckCircle className="w-8 h-8 text-white" />
                            ) : (
                                <XCircle className="w-8 h-8 text-white" />
                            )}
                            <div>
                                <p className="font-semibold text-white">{lastResult.message}</p>
                                {lastResult.studentName && (
                                    <p className="text-white/80 text-sm flex items-center gap-1">
                                        <User className="w-4 h-4" />
                                        {lastResult.studentName}
                                        {lastResult.confidence && (
                                            <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                                {(lastResult.confidence * 100).toFixed(1)}% match
                                            </span>
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex justify-center gap-4">
                {isStreaming ? (
                    <>
                        <Button
                            onClick={() => {
                                void captureImage();
                            }}
                            disabled={isProcessing}
                            icon={CameraIcon}
                            size="lg"
                        >
                            {mode === 'attendance' ? 'Mark Attendance' : 'Capture Face'}
                        </Button>
                        <Button
                            onClick={stopCamera}
                            variant="secondary"
                            icon={VideoOff}
                            size="lg"
                        >
                            Stop Camera
                        </Button>
                    </>
                ) : (
                    <Button onClick={startCamera} icon={Video} size="lg">
                        Start Camera
                    </Button>
                )}
            </div>
        </div>
    );
};
