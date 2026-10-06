import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Users, BookOpen, DoorOpen, Calendar, 
  Brain, GraduationCap, LogOut, Menu, X,
  User, Settings, LayoutGrid,
  FileText, ClipboardList, HelpCircle,
  Layers, Home, Activity
} from 'lucide-react';
import ctuLogo from '../assets/images/logos/ctulogo.png';
import AIChatBubble from './AIChatBubble';
import NotificationBell from './NotificationBell';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const mobileUserMenuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (mobileUserMenuRef.current && !mobileUserMenuRef.current.contains(event.target)) {
        setMobileUserMenuOpen(false);
      }
    };

    if (userMenuOpen || mobileUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen, mobileUserMenuOpen]);

  // Collapse sidebar when route changes
  useEffect(() => {
    setSidebarExpanded(false);
    setUserMenuOpen(false);
    setMobileUserMenuOpen(false);
  }, [location.pathname]);

  // Get avatar URL
  const getAvatarUrl = () => {
    if (user?.profilePicture) {
      return `${process.env.REACT_APP_API_URL?.replace('/api', '')}${user.profilePicture}`;
    }
    return null;
  };

  const avatarUrl = getAvatarUrl();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Navigation items based on role
  const getNavItems = () => {
    if (user?.role === 'admin' || user?.role === 'scheduling_officer' || user?.role === 'program_manager') {
      return [
        { name: 'Dashboard', path: '/dashboard', icon: Home },
        { name: 'Faculty', path: '/faculty', icon: Users },
        { name: 'Students', path: '/students', icon: GraduationCap },
        { name: 'Subjects', path: '/subjects', icon: BookOpen },
        { name: 'Rooms', path: '/rooms', icon: DoorOpen },
        { name: 'Sections', path: '/sections', icon: Layers },
        { name: 'Schedules', path: '/schedules', icon: Calendar },
        { name: 'Class Spaces', path: '/classes', icon: FileText },
        { name: 'AI Insights', path: '/ai', icon: Brain },
        { name: 'Activity Log', path: '/activity', icon: Activity }
      ];
    }

    if (user?.role === 'faculty') {
      return [
        { name: 'Dashboard', path: '/dashboard', icon: Home },
        { name: 'My Classes', path: '/classes', icon: GraduationCap },
        { name: 'My Schedule', path: '/schedules', icon: Calendar }
      ];
    }

    if (user?.role === 'student') {
      return [
        { name: 'Dashboard', path: '/dashboard', icon: Home },
        { name: 'My Classes', path: '/classes', icon: GraduationCap },
        { name: 'My Schedule', path: '/schedules', icon: Calendar }
      ];
    }

    return [{ name: 'Dashboard', path: '/dashboard', icon: Home }];
  };

  const navItems = getNavItems();
  const isActive = (path) => location.pathname === path;
  const currentPage = navItems.find(item => isActive(item.path))?.name || 'Dashboard';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#060913]">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-dark-main border-b border-gray-200 dark:border-dark-border-subtle">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
          >
            <Menu className="w-6 h-6 text-gray-700 dark:text-dark-text-secondary" />
          </button>
          
          <div className="flex items-center gap-3">
            <img src={ctuLogo} alt="CTU" className="w-8 h-8" />
            <div>
              <h1 className="text-sm font-bold text-gray-900 dark:text-dark-text-primary">CTU Daanbantayan</h1>
              <p className="text-xs text-gray-500 dark:text-dark-text-muted">Timetable System</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification Bell for Mobile */}
            <NotificationBell />
            
            {/* Profile Picture with Dropdown */}
            <div ref={mobileUserMenuRef} className="relative">
              <button
                onClick={() => setMobileUserMenuOpen(!mobileUserMenuOpen)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-300 transition-all"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </button>

              {/* Mobile Dropdown Menu */}
              {mobileUserMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-dark-card rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border-default overflow-hidden animate-fadeIn z-50">
                  <div className="py-2">
                    <Link
                      to="/profile"
                      onClick={() => setMobileUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors text-gray-700 dark:text-dark-text-secondary"
                    >
                      <User className="w-5 h-5" />
                      <span className="text-sm font-medium">My Profile</span>
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setMobileUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors text-gray-700 dark:text-dark-text-secondary"
                    >
                      <Settings className="w-5 h-5" />
                      <span className="text-sm font-medium">Settings</span>
                    </Link>
                    <div className="h-px bg-gray-200 dark:bg-dark-border-default my-2" />
                    <button
                      onClick={() => {
                        setMobileUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-dark-error"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="text-sm font-medium">Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        className={`hidden lg:flex fixed top-0 left-0 h-full bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800 dark:bg-none dark:bg-[#0B1120] shadow-2xl z-40 flex-col transition-all duration-300 ease-in-out ${
          sidebarExpanded ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo Section */}
        <div className="flex items-center justify-center py-6 px-4 border-b border-blue-500/30 dark:border-dark-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 dark:bg-dark-blue-primary rounded-xl flex items-center justify-center backdrop-blur-sm">
              <img src={ctuLogo} alt="CTU" className="w-8 h-8" />
            </div>
            <div className={`overflow-hidden transition-all duration-300 ${
              sidebarExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
            }`}>
              <h1 className="text-white dark:text-dark-text-primary font-bold text-base whitespace-nowrap">CTU Daanbantayan</h1>
              <p className="text-blue-200 dark:text-dark-text-muted text-xs whitespace-nowrap">Timetable System</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group relative ${
                  active
                    ? 'bg-yellow-400 dark:bg-dark-blue-hover text-blue-900 dark:text-white shadow-lg shadow-yellow-500/30 dark:shadow-none'
                    : 'text-blue-100 dark:text-dark-text-secondary hover:bg-white/10 dark:hover:bg-dark-hover'
                }`}
              >
                <Icon 
                  className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                    active ? 'scale-110' : 'group-hover:scale-110'
                  }`}
                />
                <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${
                  sidebarExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
                }`}>
                  {item.name}
                </span>
                
                {/* Active Indicator */}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-yellow-500 dark:bg-dark-blue-primary rounded-r-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Help Card */}
        <div className={`mx-3 mb-4 transition-all duration-300 overflow-hidden ${
          sidebarExpanded ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="bg-white/10 dark:bg-dark-elevated backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-dark-border-subtle">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-blue-200 dark:text-dark-blue-info flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-white dark:text-dark-text-primary font-semibold text-sm mb-1">Need Help?</h3>
                <p className="text-blue-200 dark:text-dark-text-muted text-xs leading-relaxed">
                  Contact IT support for assistance
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* User Profile */}
        <div ref={userMenuRef} className="p-4 border-t border-blue-500/30 dark:border-dark-border-subtle relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-3 w-full hover:bg-white/10 dark:hover:bg-dark-hover rounded-xl p-2 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 dark:bg-dark-blue-primary flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ring-white/20 dark:ring-dark-blue-primary/30">
              {avatarUrl ? (
                <img src={avatarUrl} alt="User" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-blue-900 dark:text-white" />
              )}
            </div>
            <div className={`overflow-hidden transition-all duration-300 flex-1 text-left ${
              sidebarExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
            }`}>
              <p className="text-white dark:text-dark-text-primary font-semibold text-sm whitespace-nowrap truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-blue-200 dark:text-dark-text-muted text-xs capitalize whitespace-nowrap">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && sidebarExpanded && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-dark-card rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border-default overflow-hidden animate-fadeIn">
              <div className="py-2">
                <Link
                  to="/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors text-gray-700 dark:text-dark-text-secondary"
                >
                  <User className="w-5 h-5" />
                  <span className="text-sm font-medium">My Profile</span>
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors text-gray-700 dark:text-dark-text-secondary"
                >
                  <Settings className="w-5 h-5" />
                  <span className="text-sm font-medium">Settings</span>
                </Link>
                <div className="h-px bg-gray-200 dark:bg-dark-border-default my-2" />
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-dark-error"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-medium">Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${
          mobileSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
        
        {/* Sidebar */}
        <aside
          className={`absolute top-0 left-0 h-full w-80 bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800 dark:bg-none dark:bg-[#0B1120] shadow-2xl flex flex-col transition-transform duration-300 ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-blue-500/30 dark:border-dark-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 dark:bg-dark-blue-primary rounded-xl flex items-center justify-center">
                <img src={ctuLogo} alt="CTU" className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-white dark:text-dark-text-primary font-bold text-base">CTU Daanbantayan</h1>
                <p className="text-blue-200 dark:text-dark-text-muted text-xs">Timetable System</p>
              </div>
            </div>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-white/10 dark:hover:bg-dark-hover transition-colors"
            >
              <X className="w-5 h-5 text-white dark:text-dark-text-primary" />
            </button>
          </div>

          {/* User Info */}
          <div className="p-4 bg-white/5 dark:bg-dark-elevated">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 dark:bg-dark-blue-primary flex items-center justify-center overflow-hidden ring-2 ring-white/20 dark:ring-dark-blue-primary/30">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-blue-900 dark:text-white" />
                )}
              </div>
              <div>
                <p className="text-white dark:text-dark-text-primary font-semibold text-sm">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-blue-200 dark:text-dark-text-muted text-xs capitalize">
                  {user?.role?.replace('_', ' ')}
                </p>
                {user?.program && (
                  <p className="text-yellow-400 text-xs font-medium mt-0.5">
                    {user.program}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 relative ${
                    active
                      ? 'bg-yellow-400 dark:bg-dark-blue-hover text-blue-900 dark:text-white shadow-lg shadow-yellow-500/30 dark:shadow-none'
                      : 'text-blue-100 dark:text-dark-text-secondary hover:bg-white/10 dark:hover:bg-dark-hover'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium text-sm">{item.name}</span>
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-yellow-500 dark:bg-dark-blue-primary rounded-r-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-blue-500/30 dark:border-dark-border-subtle space-y-2">
            <Link
              to="/profile"
              onClick={() => setMobileSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 dark:text-dark-text-secondary hover:bg-white/10 dark:hover:bg-dark-hover transition-colors"
            >
              <User className="w-5 h-5" />
              <span className="text-sm font-medium">My Profile</span>
            </Link>
            <Link
              to="/settings"
              onClick={() => setMobileSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 dark:text-dark-text-secondary hover:bg-white/10 dark:hover:bg-dark-hover transition-colors"
            >
              <Settings className="w-5 h-5" />
              <span className="text-sm font-medium">Settings</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-300 dark:text-dark-error hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Main Content */}
      <main className={`min-h-screen transition-all duration-300 ${
        sidebarExpanded ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        {/* Page Header - Desktop */}
        <div className="hidden lg:block sticky top-0 z-30 bg-white dark:bg-dark-main border-b border-gray-200 dark:border-dark-border-subtle backdrop-blur-sm bg-white/80 dark:bg-dark-main/80">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary">
                {currentPage}
              </h1>
              <p className="text-sm text-gray-500 dark:text-dark-text-muted mt-1">
                {user?.program ? `${user.program} Program` : 'Management System'}
              </p>
            </div>
            
            {/* Notification Bell */}
            <div>
              <NotificationBell />
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="p-4 lg:p-8 pt-20 lg:pt-4">
          {children}
        </div>
      </main>

      {/* AI Chat Bubble */}
      {(user?.role === 'admin' || user?.role === 'scheduling_officer' || user?.role === 'program_manager') && (
        <AIChatBubble />
      )}

      {/* Custom Scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Layout;
