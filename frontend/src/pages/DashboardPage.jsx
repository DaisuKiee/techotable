import React from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import ctuBg from '../assets/images/backgrounds/ctu-bg.jpg';
import StaffDashboard from '../components/StaffDashboard';
import StudentDashboard from '../components/StudentDashboard';
import FacultyDashboard from '../components/FacultyDashboard';

const STAFF_ROLES = ['admin', 'scheduling_officer', 'program_manager'];

/** Picks the dashboard for the signed-in role. */
const DashboardPage = () => {
  const { user } = useAuth();

  return (
    <Layout>
      {/* Faint campus photo behind the page */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-5"
        style={{ backgroundImage: `url(${ctuBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        aria-hidden="true"
      />
      <div className="relative z-10">
        {STAFF_ROLES.includes(user?.role) && <StaffDashboard user={user} />}
        {user?.role === 'faculty' && <FacultyDashboard user={user} />}
        {user?.role === 'student' && <StudentDashboard user={user} />}
      </div>
    </Layout>
  );
};

export default DashboardPage;
