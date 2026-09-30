# Subject Code Generation Feature

## Overview
Added randomized subject code generation for scheduling officers when creating/editing subjects. Instead of manually typing subject codes, officers can now click a "Generate" button to create unique, random codes.

## Implementation

### Backend Changes

#### 1. Subject Model (backend/models/Subject.model.js)
Added two static methods:

```javascript
// Generate random 6-character code: 2 letters + 4 digits
SubjectSchema.statics.generateSubjectCode = function() {
  // Example output: IT3101, AB1234, XY5678
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  
  let code = '';
  // 2 uppercase letters
  for (let i = 0; i < 2; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  // 4 digits
  for (let i = 0; i < 4; i++) {
    code += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  
  return code;
};

// Generate unique code (checks database for collisions)
SubjectSchema.statics.generateUniqueSubjectCode = async function() {
  let code;
  let attempts = 0;
  const maxAttempts = 50;
  
  do {
    code = this.generateSubjectCode();
    const existing = await this.findOne({ subjectCode: code });
    if (!existing) return code;
    attempts++;
  } while (attempts < maxAttempts);
  
  throw new Error('Could not generate unique subject code');
};
```

#### 2. Subject Controller (backend/controllers/subject.controller.js)
Added endpoint handler:

```javascript
exports.generateSubjectCode = async (req, res) => {
  try {
    const code = await Subject.generateUniqueSubjectCode();
    res.status(200).json({
      success: true,
      data: { subjectCode: code }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating subject code',
      error: error.message
    });
  }
};
```

#### 3. Subject Routes (backend/routes/subject.routes.js)
Added route:

```javascript
router.post('/generate-code', 
  authorize('admin', 'scheduling_officer', 'program_manager'), 
  generateSubjectCode
);
```

**Endpoint:** `POST /api/subjects/generate-code`  
**Authorization:** Admin, Scheduling Officer, Program Manager  
**Response:** `{ success: true, data: { subjectCode: "AB1234" } }`

### Frontend Changes

#### 1. API Service (frontend/src/services/api.js)
Added method:

```javascript
export const subjectAPI = {
  // ... existing methods
  generateCode: () => api.post('/subjects/generate-code')
};
```

#### 2. Subject Modal (frontend/src/components/SubjectModal.jsx)

**Added handler function:**
```javascript
const handleGenerateCode = async () => {
  try {
    const response = await subjectAPI.generateCode();
    const generatedCode = response.data.data.subjectCode;
    setFormData({
      ...formData,
      subjectCode: generatedCode
    });
    toast.success(`Generated code: ${generatedCode}`);
  } catch (error) {
    toast.error('Could not generate code');
  }
};
```

**Updated UI:**
- Changed subject code input to display flex with "Generate" button
- Added purple "Generate" button with refresh icon
- Input field auto-uppercases text
- Added helper text: "Click 'Generate' for a random code (e.g., AB1234)"

## User Experience

### Before
```
┌─────────────────────────────────┐
│ Subject Code *                  │
│ ┌─────────────────────────────┐ │
│ │ IT311                       │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```
Officers had to manually type subject codes

### After
```
┌──────────────────────────────────────────┐
│ Subject Code *                           │
│ ┌─────────────────────┬─────────────┐   │
│ │ AB1234             │ │ 🔄 Generate │   │
│ └─────────────────────┴─────────────┘   │
│ Click "Generate" for a random code       │
└──────────────────────────────────────────┘
```
Officers can:
1. Click "Generate" for automatic code
2. Still manually type if preferred
3. See toast notification with generated code

## Code Format

### Pattern
- **Length:** 6 characters
- **Format:** `[A-Z]{2}[0-9]{4}`
- **Examples:** 
  - `IT3101` - Traditional format (if manually typed)
  - `AB1234` - Generated format
  - `XY5678` - Generated format
  - `ZZ0000` - Generated format

### Uniqueness
- Checks database before assignment
- Maximum 50 attempts to find unique code
- Error thrown if all attempts fail (extremely unlikely with 676,000 possible combinations)

### Calculation
- Possible codes: 26 letters × 26 letters × 10 digits × 10 digits × 10 digits × 10 digits
- Total combinations: **676,000 unique codes**
- Collision probability increases with database size but remains low

## Benefits

### For Scheduling Officers
1. **Speed:** Generate codes instantly vs thinking of codes
2. **Consistency:** All generated codes follow same format
3. **No duplicates:** System guarantees uniqueness
4. **Less errors:** No typos or invalid characters
5. **Flexibility:** Can still manually enter codes if needed

### For System
1. **Standardization:** Generated codes have consistent format
2. **Scalability:** 676,000 possible codes supports large databases
3. **Simplicity:** 6 characters are easier to share and remember than longer codes
4. **Compatibility:** Works with existing validation and database constraints

## Usage Instructions

### Creating a New Subject
1. Navigate to **Subjects** page
2. Click **"Add Subject"** button
3. In the Subject Code field, click **"Generate"** button
4. A random code appears (e.g., `AB1234`)
5. Toast notification confirms: "Generated code: AB1234"
6. Fill in other fields and save

### Alternative: Manual Entry
1. Ignore the "Generate" button
2. Type subject code manually
3. System validates format on save

### Editing Existing Subjects
1. Open subject for editing
2. Click "Generate" to replace current code
3. Or keep existing code unchanged

## Testing

### Manual Test Steps
1. ✅ **Generate code**
   - Click "Generate" button
   - Verify code appears in format `XX0000`
   - Verify toast notification shows

2. ✅ **Code uniqueness**
   - Generate multiple codes
   - Verify each is different
   - Check database for duplicates

3. ✅ **Manual override**
   - Type "IT3101" manually
   - Verify can still save manually entered codes

4. ✅ **Uppercase enforcement**
   - Type "it3101" (lowercase)
   - Verify auto-converts to "IT3101"

5. ✅ **Authorization**
   - Try as student or faculty
   - Verify endpoint returns 403 Forbidden

6. ✅ **Edit mode**
   - Edit existing subject
   - Click "Generate"
   - Verify old code is replaced

## Security

### Authorization
- ✅ Only authorized roles can generate codes:
  - Admin
  - Scheduling Officer
  - Program Manager
- ✅ Students and faculty cannot access endpoint
- ✅ Uses existing `authorize` middleware

### Validation
- ✅ Generated codes always pass validation
- ✅ Database unique constraint prevents duplicates
- ✅ Uppercase enforcement prevents case issues

## Deployment

### Environment
- **Backend:** Render at `https://techotable.onrender.com`
- **Frontend:** Vercel at `https://technotabler.cebutech.digital`

### Database Migration
- ❌ No migration needed
- ❌ No schema changes
- ✅ Uses existing `subjectCode` field
- ✅ Backward compatible with existing codes

### Rollback Plan
If issues arise:
1. Revert backend controller and routes
2. Revert frontend SubjectModal changes
3. Officers resume manual code entry
4. Existing subjects unaffected

## Future Enhancements

### Possible Improvements
1. **Custom format:** Allow configuring code pattern per program
2. **Prefix suggestion:** Generate codes with program prefix (IT, CS, EE)
3. **Bulk generation:** Generate codes for multiple subjects at once
4. **Smart prefixes:** Auto-detect program and suggest matching prefix
5. **History:** Show previously generated codes to avoid similar codes

### Smart Generation Example
```javascript
// Instead of: AB1234
// Generate based on context:
// - Program: BSIT → IT1234
// - Program: BSCS → CS1234
// - Year: 1st Year → XX1xxx
// - Year: 4th Year → XX4xxx
```

## Files Modified

### Backend
- ✅ `backend/models/Subject.model.js` - Added generation methods
- ✅ `backend/controllers/subject.controller.js` - Added endpoint handler
- ✅ `backend/routes/subject.routes.js` - Added route

### Frontend
- ✅ `frontend/src/services/api.js` - Added API method
- ✅ `frontend/src/components/SubjectModal.jsx` - Added button and handler

## Related Features

### Similar Implementations
- **Class Code:** `ClassSpace.generateUniqueClassCode()` (8 characters, alphanumeric)
- **Section Code:** 8-digit numbers for regular students
- **Subject Code:** 6-character codes for subjects (this feature)

### Code Types Comparison
| Type | Format | Example | Used For |
|------|--------|---------|----------|
| Section Code | 8 digits | `12345678` | Regular student enrollment |
| Class Code | 8 alphanumeric | `ABCD1234` | Irregular student enrollment |
| Subject Code | 2 letters + 4 digits | `AB1234` | Subject identification |

## Conclusion

The subject code generation feature streamlines the subject creation process for scheduling officers by providing instant, unique, collision-free codes. The implementation maintains backward compatibility with manually entered codes while offering a faster, more reliable alternative.

---
**Status:** ✅ DEPLOYED  
**Date:** January 2025  
**Version:** Production  
**Deployed to:** Render (backend) + Vercel (frontend)
