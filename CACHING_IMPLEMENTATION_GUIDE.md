# Data Caching Implementation Guide

## Problem Identified

Your app has excellent caching infrastructure but **it's not being used**:
- ✅ `useCachedData.js` hook exists with stale-while-revalidate pattern
- ✅ `CacheContext.jsx` exists for cache management  
- ✅ `CacheProvider` properly wrapped in `App.js`
- ❌ **Pages are still using `useEffect` + direct API calls**

This means every page navigation triggers fresh API calls, causing slow navigation on your low-spec server.

## Solution: Apply Caching to Your Pages

Based on industry standards (SWR, React Query) and adapted to your existing hook.

---

## How Your Cache Hook Works

### Stale-While-Revalidate Pattern

```javascript
// First visit to page:
1. No cache → Show loading spinner
2. Fetch from API
3. Save to localStorage
4. Display data

// Revisit within 5 minutes:
1. Load from cache instantly (NO spinner!)
2. Display cached data immediately
3. Fetch fresh data in background (silent)
4. Update display if data changed

// Revisit after 5+ minutes:
1. Cache expired → Show loading spinner
2. Fetch fresh data
3. Update cache
4. Display data
```

This is exactly how SWR (stale-while-revalidate) library works, but you already have it built!

---

## Implementation Examples

### Example 1: Dashboard Stats (Staff View)

**BEFORE** (Current - No Caching):
```javascript
const DashboardPage = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    setLoading(true);
    try {
      const response = await dashboardAPI.getStats();
      setStats(response.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  return <div>Stats: {stats.totalUsers}</div>;
};
```

**AFTER** (With Caching):
```javascript
import useCachedData from '../hooks/useCachedData';
import { useCache } from '../context/CacheContext';

const DashboardPage = () => {
  // Replace useState + useEffect with useCachedData
  const {
    data: stats,
    loading,
    error,
    refetch,
    isFromCache
  } = useCachedData(
    () => dashboardAPI.getStats(),  // API function
    'dashboard-stats',              // Cache key
    {
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      onSuccess: (data) => {
        console.log('Stats loaded:', data);
      }
    }
  );

  // Optional: Show cache indicator
  console.log('Is from cache:', isFromCache);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading stats</div>;
  
  return (
    <div>
      Stats: {stats?.totalUsers}
      {isFromCache && <span className="text-xs text-gray-500">📦 Cached</span>}
    </div>
  );
};
```

### Example 2: Faculty Schedule (Faculty View)

**BEFORE**:
```javascript
const FacultyDashboard = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadFacultyData();
  }, []);

  const loadFacultyData = async () => {
    setLoading(true);
    try {
      const response = await scheduleAPI.getFacultySchedule(user.faculty);
      setSchedules(response.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return <div>{schedules.length} classes</div>;
};
```

**AFTER**:
```javascript
import useCachedData from '../hooks/useCachedData';

const FacultyDashboard = () => {
  const { user } = useAuth();

  const {
    data: schedules,
    loading,
    error,
    refetch
  } = useCachedData(
    () => scheduleAPI.getFacultySchedule(user.faculty),
    `faculty-schedule-${user.faculty}`,  // Unique key per faculty
    {
      cacheDuration: 3 * 60 * 1000,  // 3 minutes (schedules change often)
      enabled: !!user.faculty  // Only fetch if faculty ID exists
    }
  );

  if (loading) return <div>Loading schedule...</div>;
  if (error) return <div>Error loading schedule</div>;
  
  return <div>{schedules?.length || 0} classes</div>;
};
```

### Example 3: Student Classes (Student View)

**BEFORE**:
```javascript
const StudentDashboard = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudentData();
  }, []);

  const loadStudentData = async () => {
    setLoading(true);
    try {
      const response = await classSpaceAPI.getMyClasses();
      setClasses(response.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return <div>{classes.length} classes</div>;
};
```

**AFTER**:
```javascript
import useCachedData from '../hooks/useCachedData';

const StudentDashboard = () => {
  const { user } = useAuth();

  const {
    data: classes,
    loading,
    error,
    refetch
  } = useCachedData(
    () => classSpaceAPI.getMyClasses(),
    `student-classes-${user._id}`,  // Unique per student
    {
      cacheDuration: 5 * 60 * 1000  // 5 minutes
    }
  );

  if (loading) return <div>Loading classes...</div>;
  if (error) return <div>Error loading classes</div>;
  
  return <div>{classes?.length || 0} classes</div>;
};
```

---

## Cache Invalidation

When data changes (create, update, delete), invalidate the cache:

```javascript
import { useCache } from '../context/CacheContext';

const FacultyPage = () => {
  const { invalidateCache } = useCache();

  const {
    data: faculty,
    refetch
  } = useCachedData(
    () => facultyAPI.getAll(),
    'all-faculty',
    { cacheDuration: 5 * 60 * 1000 }
  );

  const handleCreateFaculty = async (newFaculty) => {
    try {
      await facultyAPI.create(newFaculty);
      
      // Invalidate cache and refetch
      invalidateCache('all-faculty');
      refetch();  // Or just call refetch(), it will fetch fresh data
      
      toast.success('Faculty created!');
    } catch (error) {
      toast.error('Failed to create faculty');
    }
  };

  const handleDeleteFaculty = async (id) => {
    try {
      await facultyAPI.delete(id);
      
      // Invalidate and refetch
      invalidateCache('all-faculty');
      refetch();
      
      toast.success('Faculty deleted!');
    } catch (error) {
      toast.error('Failed to delete faculty');
    }
  };

  return (
    <div>
      {faculty?.map(f => (
        <div key={f._id}>
          {f.name}
          <button onClick={() => handleDeleteFaculty(f._id)}>Delete</button>
        </div>
      ))}
      <button onClick={() => handleCreateFaculty({name: 'New Faculty'})}>
        Add Faculty
      </button>
    </div>
  );
};
```

---

## Pages to Update

Apply caching to these high-traffic pages:

### 1. **DashboardPage.jsx** (Priority: HIGH)
- Staff stats: `dashboard-stats` (5 min)
- Faculty schedule: `faculty-schedule-{id}` (3 min)
- Student classes: `student-classes-{id}` (5 min)
- Conflicts: `schedule-conflicts` (5 min)

### 2. **FacultyPage.jsx**
- Faculty list: `all-faculty` (5 min)
- Faculty details: `faculty-{id}` (10 min)

### 3. **SubjectPage.jsx**
- Subjects list: `all-subjects` (5 min)
- Subject details: `subject-{id}` (10 min)

### 4. **RoomPage.jsx**
- Rooms list: `all-rooms` (10 min)

### 5. **SchedulePage.jsx**
- Schedules: `all-schedules` (3 min)
- Published schedules: `published-schedules` (5 min)

### 6. **SectionPage.jsx**
- Sections: `all-sections` (5 min)

### 7. **StudentPage.jsx**
- Students: `all-students` (5 min)

### 8. **ClassSpacePage.jsx**
- Classes: `my-classes-{userId}` (5 min)

---

## Cache Duration Guidelines

```javascript
// Fast-changing data (schedules, conflicts)
cacheDuration: 3 * 60 * 1000  // 3 minutes

// Normal data (faculty, subjects, students)
cacheDuration: 5 * 60 * 1000  // 5 minutes

// Slow-changing data (rooms, static data)
cacheDuration: 10 * 60 * 1000  // 10 minutes

// Profile data
cacheDuration: 15 * 60 * 1000  // 15 minutes
```

---

## Advanced: Multiple Data Sources

When a page needs multiple API calls:

```javascript
const DashboardPage = () => {
  // Cache each API call separately
  const {
    data: stats,
    loading: loadingStats
  } = useCachedData(
    () => dashboardAPI.getStats(),
    'dashboard-stats',
    { cacheDuration: 5 * 60 * 1000 }
  );

  const {
    data: conflicts,
    loading: loadingConflicts
  } = useCachedData(
    () => scheduleAPI.getConflicts(true),
    'schedule-conflicts',
    { cacheDuration: 3 * 60 * 1000 }
  );

  const {
    data: notifications,
    loading: loadingNotifications
  } = useCachedData(
    () => notificationAPI.getUnread(),
    'unread-notifications',
    { cacheDuration: 1 * 60 * 1000 }  // 1 minute (very fresh)
  );

  const loading = loadingStats || loadingConflicts || loadingNotifications;

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div>
      <div>Total Users: {stats?.totalUsers}</div>
      <div>Conflicts: {conflicts?.length}</div>
      <div>Notifications: {notifications?.length}</div>
    </div>
  );
};
```

---

## Testing the Cache

### 1. Open Browser DevTools → Application → Local Storage

You should see entries like:
```
cache_dashboard-stats: {"totalUsers": 150, ...}
cache_timestamp_dashboard-stats: 1704123456789
```

### 2. Test the Flow

1. **First visit**: 
   - Console: `[useCachedData] No cache found for dashboard-stats, fetching with spinner`
   - Network tab shows API call
   - Loading spinner appears

2. **Navigate away and back** (within 5 min):
   - Console: `[useCachedData] Found cached data for dashboard-stats`
   - Console: `[useCachedData] Starting background refresh for dashboard-stats`
   - **NO loading spinner!**
   - Data appears instantly
   - Network tab shows API call happening silently

3. **Wait 6+ minutes, then revisit**:
   - Console: `[useCachedData] Cache expired for dashboard-stats`
   - Loading spinner appears
   - Fresh fetch happens

---

## Benefits You'll See

### 1. **Instant Page Navigation**
- Dashboard → Faculty → Dashboard = instant
- No waiting for API calls on revisit

### 2. **Reduced Server Load**
- Fewer API calls = less CPU/RAM usage
- Background refreshes are silent and async

### 3. **Better UX on Slow Connection**
- Cached data shows immediately
- Users can interact while fresh data loads

### 4. **Offline Tolerance**
- Last fetched data persists in localStorage
- Users can view stale data even if API is down

---

## Implementation Checklist

- [ ] Update `DashboardPage.jsx` with caching
- [ ] Update `FacultyPage.jsx` with caching
- [ ] Update `SubjectPage.jsx` with caching
- [ ] Update `RoomPage.jsx` with caching
- [ ] Update `SchedulePage.jsx` with caching
- [ ] Update `SectionPage.jsx` with caching
- [ ] Update `StudentPage.jsx` with caching
- [ ] Update `ClassSpacePage.jsx` with caching
- [ ] Add cache invalidation on create/update/delete operations
- [ ] Test cache behavior in DevTools
- [ ] Verify background refresh works
- [ ] Check localStorage storage size

---

## Common Pitfalls to Avoid

### ❌ Don't Use Same Cache Key for Different Data
```javascript
// BAD
useCachedData(() => facultyAPI.getById(id), 'faculty');  // Same key!
useCachedData(() => facultyAPI.getById(otherId), 'faculty');  // Same key!

// GOOD
useCachedData(() => facultyAPI.getById(id), `faculty-${id}`);
useCachedData(() => facultyAPI.getById(otherId), `faculty-${otherId}`);
```

### ❌ Don't Forget to Invalidate Cache on Mutations
```javascript
// BAD
const handleDelete = async (id) => {
  await facultyAPI.delete(id);
  // Cache still shows deleted item!
};

// GOOD
const handleDelete = async (id) => {
  await facultyAPI.delete(id);
  invalidateCache('all-faculty');
  refetch();
};
```

### ❌ Don't Cache User-Specific Data with Generic Keys
```javascript
// BAD
useCachedData(() => classSpaceAPI.getMyClasses(), 'classes');
// If user A logs out and user B logs in, user B sees user A's data!

// GOOD
useCachedData(() => classSpaceAPI.getMyClasses(), `classes-${user._id}`);
```

---

## Next Steps

1. Start with **DashboardPage.jsx** (highest impact)
2. Test thoroughly with DevTools
3. Roll out to other pages one by one
4. Monitor localStorage size (browsers have ~5-10MB limit)
5. Add cache clearing on logout

Would you like me to implement this on your actual pages now?
