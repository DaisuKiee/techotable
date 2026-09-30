const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Read the Excel file
const filePath = path.join(__dirname, '..', 'FacultyProfiles.xlsx');
const workbook = XLSX.readFile(filePath);

// Get the first sheet
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Get the range
const range = XLSX.utils.decode_range(worksheet['!ref']);
console.log('Sheet range:', worksheet['!ref']);

// Read all cells to understand structure
console.log('\n=== First few rows ===');
for (let R = range.s.r; R <= Math.min(range.s.r + 10, range.e.r); R++) {
  const row = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
    const cell = worksheet[cellAddress];
    row.push(cell ? cell.v : '');
  }
  console.log(`Row ${R}:`, row.filter(v => v !== '').join(' | '));
}

// Try converting with range
const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
  range: 0,
  defval: ''
});

console.log('\n=== JSON conversion ===');
console.log('Total rows:', jsonData.length);
console.log('\nFirst row keys:', Object.keys(jsonData[0] || {}));
console.log('\nFirst 3 rows:');
console.log(JSON.stringify(jsonData.slice(0, 3), null, 2));

// Save raw data
fs.writeFileSync(
  path.join(__dirname, 'facultyProfilesRaw.json'),
  JSON.stringify(jsonData, null, 2)
);
console.log('\nRaw data saved to backend/facultyProfilesRaw.json');


