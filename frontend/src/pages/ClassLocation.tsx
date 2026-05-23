import React, { useCallback, useEffect, useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button, Card } from '../components/ui';
import { academicsApi, adminApi } from '../services/endpoints';
import type { AcademicClass } from '../types';

export const ClassLocation: React.FC = () => {
    const [classes, setClasses] = useState<AcademicClass[]>([]);
    const [classId, setClassId] = useState<number | null>(null);
    const [lat, setLat] = useState<number | null>(null);
    const [lon, setLon] = useState<number | null>(null);
    const [isLoadingClasses, setIsLoadingClasses] = useState(true);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const [isGettingCurrentLocation, setIsGettingCurrentLocation] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const loadClasses = async () => {
            setIsLoadingClasses(true);
            try {
                const classRows = await academicsApi.listClasses();
                setClasses(classRows);
                if (classRows.length > 0) {
                    setClassId(classRows[0].id);
                }
            } catch {
                toast.error('Failed to load classes');
            } finally {
                setIsLoadingClasses(false);
            }
        };
        void loadClasses();
    }, []);

    useEffect(() => {
        const loadClassLocation = async () => {
            if (!classId) {
                setLat(null);
                setLon(null);
                return;
            }

            setIsFetchingLocation(true);
            try {
                const location = await adminApi.getClassLocation(classId);
                setLat(location.latitude);
                setLon(location.longitude);
            } catch (error: any) {
                toast.error(error?.response?.data?.detail || 'Failed to load class location');
                setLat(null);
                setLon(null);
            } finally {
                setIsFetchingLocation(false);
            }
        };
        void loadClassLocation();
    }, [classId]);

    const getCurrentLocation = useCallback(async () => {
        if (!navigator.geolocation) {
            toast.error('Location access is required to mark attendance');
            return;
        }

        setIsGettingCurrentLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLat(position.coords.latitude);
                setLon(position.coords.longitude);
                setIsGettingCurrentLocation(false);
            },
            () => {
                toast.error('Location access is required to mark attendance');
                setIsGettingCurrentLocation(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    }, []);

    const saveLocation = useCallback(async () => {
        if (!classId) {
            toast.error('Select a class first');
            return;
        }
        if (lat === null || lon === null) {
            toast.error('Get classroom location before saving');
            return;
        }

        setIsSaving(true);
        try {
            await adminApi.updateClassLocation(classId, {
                latitude: lat,
                longitude: lon,
            });
            toast.success('Class location saved');
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to save class location');
        } finally {
            setIsSaving(false);
        }
    }, [classId, lat, lon]);

    const clearLocation = useCallback(async () => {
        if (!classId) {
            toast.error('Select a class first');
            return;
        }

        const confirmed = window.confirm('Delete saved location for this class?');
        if (!confirmed) {
            return;
        }

        setIsDeleting(true);
        try {
            await adminApi.clearClassLocation(classId);
            setLat(null);
            setLon(null);
            toast.success('Saved location deleted');
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to delete class location');
        } finally {
            setIsDeleting(false);
        }
    }, [classId]);

    return (
        <div className="space-y-6 animate-in max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <MapPin className="w-7 h-7 text-primary-300" />
                    Class Location
                </h1>
                <p className="text-white/55">
                    Select a class, capture the classroom location, and save it for attendance geofence checks.
                </p>
            </div>

            <Card className="p-6 space-y-5">
                <div>
                    <label className="block text-sm text-white/70 mb-2">Class</label>
                    <select
                        value={classId ?? ''}
                        onChange={(event) => setClassId(Number(event.target.value))}
                        disabled={isLoadingClasses || classes.length === 0}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white disabled:opacity-50"
                    >
                        {classes.map((classRow) => (
                            <option key={classRow.id} value={classRow.id}>
                                {classRow.department_code} - Year {classRow.year} Sec {classRow.section}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-wrap gap-3">
                    <Button
                        icon={LocateFixed}
                        onClick={getCurrentLocation}
                        isLoading={isGettingCurrentLocation}
                        disabled={!classId}
                    >
                        Get Current Location
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={saveLocation}
                        isLoading={isSaving}
                        disabled={!classId || lat === null || lon === null}
                    >
                        Save Location
                    </Button>
                    <Button
                        variant="danger"
                        onClick={clearLocation}
                        isLoading={isDeleting}
                        disabled={!classId || (lat === null && lon === null)}
                    >
                        Delete Saved Location
                    </Button>
                </div>

                <div className="rounded-xl border border-white/10 bg-dark-900/40 p-4">
                    {isFetchingLocation ? (
                        <p className="text-white/60 text-sm">Loading saved location...</p>
                    ) : lat === null || lon === null ? (
                        <p className="text-white/60 text-sm">No location saved for this class yet.</p>
                    ) : (
                        <div className="space-y-1">
                            <p className="text-white text-sm">
                                Latitude: <span className="text-primary-300 font-medium">{lat.toFixed(6)}</span>
                            </p>
                            <p className="text-white text-sm">
                                Longitude: <span className="text-primary-300 font-medium">{lon.toFixed(6)}</span>
                            </p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};
