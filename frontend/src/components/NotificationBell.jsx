import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, X, Trash2 } from 'lucide-react';
import { notificationAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await notificationAPI.getAll({ limit: 10 });
      setNotifications(response.data.data);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Fetch unread count only
  const fetchUnreadCount = async () => {
    try {
      const response = await notificationAPI.getUnreadCount();
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Mark notification as read
  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.isRead) {
        await notificationAPI.markAsRead(notification._id);
        setNotifications(prev =>
          prev.map(n => n._id === notification._id ? { ...n, isRead: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      // Navigate if there's a link
      if (notification.link) {
        navigate(notification.link);
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      await notificationAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    } finally {
      setLoading(false);
    }
  };

  // Delete notification
  const handleDelete = async (e, notificationId) => {
    e.stopPropagation();
    try {
      await notificationAPI.delete(notificationId);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
      const wasUnread = notifications.find(n => n._id === notificationId)?.isRead === false;
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  // Get icon by type
  const getNotificationIcon = (type, metadata) => {
    const icons = {
      schedule: '📅',
      announcement: '📢',
      material: '📎',
      system: '⚙️'
    };
    return metadata?.icon || icons[type] || '🔔';
  };

  // Get color by type
  const getNotificationColor = (type, metadata) => {
    const colors = {
      schedule: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      announcement: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      material: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      system: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
    };
    return colors[type] || colors.system;
  };

  // Format time ago
  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />

          {/* Notification Panel */}
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 max-h-[32rem] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                    ({unreadCount} new)
                  </span>
                )}
              </h3>
              {notifications.length > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={loading || unreadCount === 0}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                  <Bell className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                      !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg ${getNotificationColor(notification.type, notification.metadata)}`}>
                        {getNotificationIcon(notification.type, notification.metadata)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {notification.title}
                          </h4>
                          <button
                            onClick={(e) => handleDelete(e, notification._id)}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {timeAgo(notification.createdAt)}
                          </span>
                          {!notification.isRead && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
