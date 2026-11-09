import React from 'react';
import { AlertTriangle, X, Clock, MapPin, User } from 'lucide-react';

const ConflictWarning = ({ conflicts, onDismiss }) => {
  if (!conflicts || conflicts.length === 0) return null;

  const getConflictIcon = (type) => {
    switch (type) {
      case 'faculty':
        return <User size={16} />;
      case 'room':
        return <MapPin size={16} />;
      case 'time':
        return <Clock size={16} />;
      default:
        return <AlertTriangle size={16} />;
    }
  };

  const getConflictColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'medium':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'low':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 max-w-md z-50 animate-slide-up">
      <div className="bg-white rounded-lg shadow-xl border-2 border-orange-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-orange-50">
          <div className="flex items-center">
            <AlertTriangle className="text-orange-600 mr-3" size={24} />
            <div>
              <h3 className="font-semibold text-gray-900">
                {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Detected
              </h3>
              <p className="text-xs text-gray-600">
                Review and resolve conflicts before saving
              </p>
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Conflict List */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-2">
          {conflicts.map((conflict, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${getConflictColor(conflict.severity || 'medium')}`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0 mr-2">
                  {getConflictIcon(conflict.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium mb-1">
                    {conflict.type ? `${conflict.type.charAt(0).toUpperCase() + conflict.type.slice(1)} Conflict` : 'Conflict'}
                  </p>
                  <p className="text-xs">
                    {conflict.message || conflict.description || 'A scheduling conflict was detected'}
                  </p>
                  {conflict.details && (
                    <div className="mt-2 text-xs space-y-1">
                      {conflict.details.day && (
                        <p>• Day: {conflict.details.day}</p>
                      )}
                      {conflict.details.time && (
                        <p>• Time: {conflict.details.time}</p>
                      )}
                      {conflict.details.room && (
                        <p>• Room: {conflict.details.room}</p>
                      )}
                      {conflict.details.faculty && (
                        <p>• Faculty: {conflict.details.faculty}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600 text-center">
          Fix conflicts or adjust time slots before proceeding
        </div>
      </div>
    </div>
  );
};

export default ConflictWarning;
