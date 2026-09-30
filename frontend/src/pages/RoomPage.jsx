import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { roomAPI } from '../services/api';
import toast from 'react-hot-toast';
import { 
  Plus, Search, Edit2, Trash2, DoorOpen, 
  Users, Monitor, Wrench, Building, X, Grid3x3, List,
  Layers, TrendingUp, CheckCircle
} from 'lucide-react';
import RoomModal from '../components/RoomModal';
import ConfirmDialog from '../components/ConfirmDialog';

const ROOM_TYPES = ['Lecture Room', 'Laboratory', 'Computer Lab', 'Workshop', 'Auditorium', 'Conference Room'];

const RoomPage = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [modalMode, setModalMode] = useState('create');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalCapacity: 0,
    avgCapacity: 0
  });

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    itemName: '',
    onConfirm: null
  });

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [rooms]);

  const loadRooms = async () => {
    try {
      setLoading(true);
      // Only load active rooms (excluding soft-deleted ones)
      const response = await roomAPI.getAll({ isActive: true });
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Load rooms error:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const totalCapacity = rooms.reduce((sum, room) => sum + (room.capacity || 0), 0);
    setStats({
      total: rooms.length,
      active: rooms.filter(r => r.isActive).length,
      totalCapacity,
      avgCapacity: rooms.length > 0 ? Math.round(totalCapacity / rooms.length) : 0
    });
  };

  const handleCreate = () => {
    setSelectedRoom(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleEdit = (room) => {
    setSelectedRoom(room);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleDelete = async (room) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Room',
      message: 'Are you sure you want to delete this room? This action cannot be undone.',
      itemName: `${room.roomNumber} - ${room.building} (Capacity: ${room.capacity})`,
      onConfirm: async () => {
        try {
          await roomAPI.delete(room._id);
          toast.success('Room deleted successfully');
          loadRooms();
        } catch (error) {
          console.error('Delete error:', error);
          
          // Show specific error message from backend
          if (error.response?.status === 403) {
            toast.error(error.response?.data?.message || 'You do not have permission to delete this room');
          } else {
            toast.error(error.response?.data?.message || 'Failed to delete room');
          }
        }
      }
    });
  };

  const handleModalClose = (shouldRefresh) => {
    setShowModal(false);
    setSelectedRoom(null);
    if (shouldRefresh) {
      loadRooms();
    }
  };

  // Helper functions to handle different field names
  const getRoomNumber = (room) => room.roomNumber || room.roomCode || 'N/A';
  const getRoomType = (room) => room.type || room.roomType || 'Lecture Room';
  const getRoomCapacity = (room) => room.capacity || 0;
  const getRoomActive = (room) => room.isActive !== false;

  // Filter rooms
  const filteredRooms = rooms.filter((room) => {
    const roomNumber = getRoomNumber(room);
    const roomName = room.roomName || '';
    const building = room.building || '';
    const roomType = getRoomType(room);
    
    const matchesSearch = 
      roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roomName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      building.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = !filterType || roomType === filterType;

    return matchesSearch && matchesType;
  });

  // Group rooms by building
  const roomsByBuilding = filteredRooms.reduce((acc, room) => {
    const building = room.building || 'Unassigned';
    if (!acc[building]) {
      acc[building] = [];
    }
    acc[building].push(room);
    return acc;
  }, {});

  const getRoomTypeIcon = (type) => {
    switch (type) {
      case 'Computer Lab':
        return <Monitor className="text-blue-600" size={20} />;
      case 'Laboratory':
        return <Wrench className="text-purple-600" size={20} />;
      case 'Workshop':
        return <Wrench className="text-orange-600" size={20} />;
      case 'Auditorium':
        return <Users className="text-red-600" size={20} />;
      case 'Conference Room':
        return <Users className="text-green-600" size={20} />;
      default:
        return <DoorOpen className="text-gray-600" size={20} />;
    }
  };

  const getRoomTypeColor = (type) => {
    switch (type) {
      case 'Computer Lab':
        return 'bg-blue-100 text-blue-800';
      case 'Laboratory':
        return 'bg-purple-100 text-purple-800';
      case 'Workshop':
        return 'bg-orange-100 text-orange-800';
      case 'Auditorium':
        return 'bg-red-100 text-red-800';
      case 'Conference Room':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Room Management
            </h1>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Add Room</span>
            </button>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
            Manage classrooms, laboratories, and facilities
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-indigo-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <DoorOpen className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">TOTAL</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.total}</div>
            <div className="text-xs opacity-80 mt-1">Rooms</div>
          </div>

          <div className="bg-green-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">ACTIVE</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.active}</div>
            <div className="text-xs opacity-80 mt-1">Available</div>
          </div>

          <div className="bg-blue-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">CAPACITY</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.totalCapacity}</div>
            <div className="text-xs opacity-80 mt-1">Total Seats</div>
          </div>

          <div className="bg-orange-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">AVERAGE</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.avgCapacity}</div>
            <div className="text-xs opacity-80 mt-1">Avg. Capacity</div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by room number, name, or building..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all"
              >
                <option value="">All Room Types</option>
                {ROOM_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              {/* View Toggle */}
              <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                  title="Grid View"
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 border-l border-gray-300 dark:border-gray-600 transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                  title="List View"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Active Filters */}
          {(searchTerm || filterType) && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
              <div className="flex flex-wrap gap-2">
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded-md">
                    Search: {searchTerm}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-indigo-900 dark:hover:text-indigo-100" 
                      onClick={() => setSearchTerm('')}
                    />
                  </span>
                )}
                {filterType && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded-md">
                    Type: {filterType}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-indigo-900 dark:hover:text-indigo-100" 
                      onClick={() => setFilterType('')}
                    />
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterType('');
                  }}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rooms Display */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400 text-lg">Loading rooms...</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
            <DoorOpen className="w-20 h-20 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {rooms.length === 0 ? 'No rooms created yet' : 'No rooms match your filters'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {rooms.length === 0 
                ? 'Get started by creating your first room'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
            {rooms.length === 0 && (
              <button
                onClick={handleCreate}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create First Room
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="space-y-6">
            {Object.keys(roomsByBuilding).sort().map((building) => (
              <div key={building} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                {/* Building Header */}
                <div className="bg-indigo-600 px-6 py-4">
                  <div className="flex items-center text-white">
                    <Building className="w-6 h-6 mr-3" />
                    <div>
                      <h2 className="text-xl font-semibold">{building}</h2>
                      <p className="text-purple-100 text-sm">
                        {roomsByBuilding[building].length} {roomsByBuilding[building].length === 1 ? 'room' : 'rooms'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rooms Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                  {roomsByBuilding[building].map((room) => (
                    <div
                      key={room._id}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-xl hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-200 transform hover:-translate-y-1"
                    >
                      {/* Room Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                            {getRoomTypeIcon(getRoomType(room))}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate">
                              {getRoomNumber(room)}
                            </h3>
                            {room.roomName && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{room.roomName}</p>
                            )}
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${
                          getRoomActive(room) ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        }`}>
                          {getRoomActive(room) ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {/* Room Details */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${getRoomTypeColor(getRoomType(room))} dark:opacity-90`}>
                            {getRoomType(room)}
                          </span>
                          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
                            <Users className="w-4 h-4 text-gray-500" />
                            {getRoomCapacity(room)} seats
                          </div>
                        </div>

                        {/* Equipment */}
                        {room.equipment && room.equipment.length > 0 && (
                          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                              <Monitor className="w-3.5 h-3.5" />
                              Equipment:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {room.equipment.slice(0, 3).map((eq, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium"
                                  title={`${typeof eq === 'object' ? eq.name : eq} - Qty: ${typeof eq === 'object' ? eq.quantity : '1'} - ${typeof eq === 'object' ? eq.condition : 'Good'}`}
                                >
                                  {typeof eq === 'object' ? `${eq.name} (${eq.quantity})` : eq}
                                </span>
                              ))}
                              {room.equipment.length > 3 && (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                                  +{room.equipment.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Unavailable Slots */}
                        {room.unavailableSlots && room.unavailableSlots.length > 0 && (
                          <div>
                            <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                              ⚠️ {room.unavailableSlots.length} unavailable {room.unavailableSlots.length === 1 ? 'slot' : 'slots'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => handleEdit(room)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md font-medium"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(room)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md font-medium"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Room
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Building
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Capacity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Equipment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRooms.map((room) => (
                    <tr 
                      key={room._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900 rounded">
                            {getRoomTypeIcon(getRoomType(room))}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {getRoomNumber(room)}
                            </div>
                            {room.roomName && (
                              <div className="text-xs text-gray-600 dark:text-gray-400">{room.roomName}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-gray-900 dark:text-white">
                          <Building className="w-4 h-4 text-gray-400" />
                          {room.building || 'Unassigned'}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getRoomTypeColor(getRoomType(room))}`}>
                          {getRoomType(room)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-gray-900 dark:text-white font-medium">
                          <Users className="w-4 h-4 text-gray-400" />
                          {getRoomCapacity(room)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {room.equipment && room.equipment.length > 0 ? (
                          <div className="text-sm text-gray-900 dark:text-white">
                            {room.equipment.length} {room.equipment.length === 1 ? 'item' : 'items'}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">No equipment</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          getRoomActive(room) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {getRoomActive(room) ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(room)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(room)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <RoomModal
          mode={modalMode}
          room={selectedRoom}
          onClose={handleModalClose}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        itemName={confirmDialog.itemName}
      />
    </Layout>
  );
};

export default RoomPage;
