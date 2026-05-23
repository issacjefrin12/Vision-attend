import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const DashboardLayout: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Background effects */}
            <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(30,64,175,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.1),transparent_35%)]" />

            {/* Sidebar */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main content */}
            <div className="lg:ml-72 min-h-screen">
                <Header onMenuClick={() => setSidebarOpen(true)} />

                <main className="p-4 lg:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
