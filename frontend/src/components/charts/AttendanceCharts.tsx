import React from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Card } from '../ui';

interface AttendanceChartProps {
    data: Array<{
        date: string;
        present: number;
        late: number;
        absent: number;
    }>;
    title?: string;
}

const COLORS = {
    present: '#22c55e',
    late: '#eab308',
    absent: '#ef4444',
};

export const AttendanceTrendChart: React.FC<AttendanceChartProps> = ({ data, title }) => {
    return (
        <Card className="p-6">
            {title && <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>}
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.present} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={COLORS.present} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.late} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={COLORS.late} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.absent} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={COLORS.absent} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis
                            dataKey="date"
                            stroke="rgba(255,255,255,0.5)"
                            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                        />
                        <YAxis
                            stroke="rgba(255,255,255,0.5)"
                            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                color: 'white',
                            }}
                        />
                        <Legend />
                        <Area
                            type="monotone"
                            dataKey="present"
                            stroke={COLORS.present}
                            fillOpacity={1}
                            fill="url(#colorPresent)"
                            name="Present"
                        />
                        <Area
                            type="monotone"
                            dataKey="late"
                            stroke={COLORS.late}
                            fillOpacity={1}
                            fill="url(#colorLate)"
                            name="Late"
                        />
                        <Area
                            type="monotone"
                            dataKey="absent"
                            stroke={COLORS.absent}
                            fillOpacity={1}
                            fill="url(#colorAbsent)"
                            name="Absent"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

interface AttendanceBarChartProps {
    data: Array<{
        date: string;
        present: number;
        late: number;
        absent: number;
    }>;
    title?: string;
}

export const AttendanceBarChart: React.FC<AttendanceBarChartProps> = ({ data, title }) => {
    return (
        <Card className="p-6">
            {title && <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>}
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis
                            dataKey="date"
                            stroke="rgba(255,255,255,0.5)"
                            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                        />
                        <YAxis
                            stroke="rgba(255,255,255,0.5)"
                            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                color: 'white',
                            }}
                        />
                        <Legend />
                        <Bar dataKey="present" fill={COLORS.present} name="Present" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="late" fill={COLORS.late} name="Late" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="absent" fill={COLORS.absent} name="Absent" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

interface PieChartData {
    name: string;
    value: number;
    color: string;
}

interface AttendancePieChartProps {
    present: number;
    late: number;
    absent: number;
    title?: string;
    variant?: 'card' | 'embedded';
    showLegend?: boolean;
    className?: string;
}

export const AttendancePieChart: React.FC<AttendancePieChartProps> = ({
    present,
    late,
    absent,
    title,
    variant = 'card',
    showLegend,
    className,
}) => {
    const data: PieChartData[] = [
        { name: 'Present', value: present, color: COLORS.present },
        { name: 'Late', value: late, color: COLORS.late },
        { name: 'Absent', value: absent, color: COLORS.absent },
    ];

    const legendEnabled = showLegend ?? variant === 'card';
    const chart = (
        <>
            {title && <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>}
            <div className={variant === 'embedded' ? 'h-full w-full' : 'h-64'}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                color: 'white',
                            }}
                        />
                        {legendEnabled && <Legend />}
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </>
    );

    if (variant === 'embedded') {
        return (
            <div className={className}>
                {chart}
            </div>
        );
    }

    return (
        <Card className={`p-6 ${className || ''}`.trim()}>
            {chart}
        </Card>
    );
};
