/**
 * Test script to verify getFacultyName() handles all edge cases
 */

// Simulate the helper function
function getFacultyName(faculty) {
  if (!faculty) return 'Unknown Faculty';
  if (faculty.user && faculty.user.firstName) {
    return `${faculty.user.firstName} ${faculty.user.lastName || ''}`.trim();
  }
  return faculty.employeeId || faculty._id?.toString() || 'Unknown Faculty';
}

// Test cases
const testCases = [
  {
    name: 'Valid faculty with full user',
    faculty: {
      _id: '123',
      employeeId: 'FAC001',
      user: { firstName: 'Juan', lastName: 'Dela Cruz' }
    },
    expected: 'Juan Dela Cruz'
  },
  {
    name: 'Faculty with null user',
    faculty: {
      _id: '123',
      employeeId: 'FAC001',
      user: null
    },
    expected: 'FAC001'
  },
  {
    name: 'Faculty with user but no firstName',
    faculty: {
      _id: '123',
      employeeId: 'FAC001',
      user: { firstName: null, lastName: 'Doe' }
    },
    expected: 'FAC001'
  },
  {
    name: 'Faculty with user but empty firstName',
    faculty: {
      _id: '123',
      employeeId: 'FAC001',
      user: { firstName: '', lastName: 'Doe' }
    },
    expected: 'FAC001'
  },
  {
    name: 'Faculty with only firstName (no lastName)',
    faculty: {
      _id: '123',
      employeeId: 'FAC001',
      user: { firstName: 'Juan', lastName: null }
    },
    expected: 'Juan'
  },
  {
    name: 'Faculty without employeeId',
    faculty: {
      _id: '123',
      employeeId: null,
      user: null
    },
    expected: '123'
  },
  {
    name: 'Null faculty',
    faculty: null,
    expected: 'Unknown Faculty'
  },
  {
    name: 'Undefined faculty',
    faculty: undefined,
    expected: 'Unknown Faculty'
  },
  {
    name: 'Empty object faculty',
    faculty: {},
    expected: 'Unknown Faculty'
  }
];

// Run tests
console.log('🧪 Testing getFacultyName() function\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = getFacultyName(test.faculty);
  const isPass = result === test.expected;
  
  if (isPass) {
    console.log(`✅ Test ${index + 1}: ${test.name}`);
    console.log(`   Result: "${result}"`);
    passed++;
  } else {
    console.log(`❌ Test ${index + 1}: ${test.name}`);
    console.log(`   Expected: "${test.expected}"`);
    console.log(`   Got: "${result}"`);
    failed++;
  }
  console.log('');
});

console.log('='.repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
  console.log('✅ All tests passed! The function handles all edge cases correctly.');
} else {
  console.log('❌ Some tests failed. Please review the implementation.');
}
