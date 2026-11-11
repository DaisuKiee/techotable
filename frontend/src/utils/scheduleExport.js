import toast from 'react-hot-toast';
// Schedule Export Utilities

/**
 * Export schedule to CSV format
 */
export const exportToCSV = (schedules, filename = 'schedule.csv') => {
  if (!schedules || schedules.length === 0) {
    toast('No schedules to export. Adjust the filters first.');
    return;
  }

  // Define CSV headers
  const headers = [
    'Subject Code',
    'Subject Name',
    'Faculty',
    'Room',
    'Program',
    'Year',
    'Section',
    'Day',
    'Start Time',
    'End Time',
    'Type',
    'Max Students',
    'Semester',
    'Academic Year',
    'Status'
  ];

  // Convert schedules to CSV rows
  const rows = [];
  schedules.forEach(schedule => {
    const baseInfo = {
      subjectCode: schedule.subject?.subjectCode || '',
      subjectName: schedule.subject?.subjectName || '',
      faculty: `${schedule.faculty?.user?.firstName || ''} ${schedule.faculty?.user?.lastName || ''}`.trim(),
      room: schedule.room?.roomNumber || '',
      program: schedule.program || '',
      year: schedule.yearLevel || '',
      section: schedule.section || '',
      maxStudents: schedule.maxStudents || '',
      semester: schedule.semester || '',
      academicYear: schedule.academicYear || '',
      status: schedule.isPublished ? 'Published' : 'Draft'
    };

    // Create a row for each time slot
    if (schedule.timeSlots && schedule.timeSlots.length > 0) {
      schedule.timeSlots.forEach(slot => {
        rows.push({
          ...baseInfo,
          day: slot.day || '',
          startTime: slot.startTime || '',
          endTime: slot.endTime || '',
          type: slot.type || ''
        });
      });
    } else {
      // If no time slots, add one row with empty time info
      rows.push({
        ...baseInfo,
        day: '',
        startTime: '',
        endTime: '',
        type: ''
      });
    }
  });

  // Build CSV content
  let csvContent = headers.join(',') + '\n';
  
  rows.forEach(row => {
    const values = [
      escapeCsvValue(row.subjectCode),
      escapeCsvValue(row.subjectName),
      escapeCsvValue(row.faculty),
      escapeCsvValue(row.room),
      escapeCsvValue(row.program),
      escapeCsvValue(row.year),
      escapeCsvValue(row.section),
      escapeCsvValue(row.day),
      escapeCsvValue(row.startTime),
      escapeCsvValue(row.endTime),
      escapeCsvValue(row.type),
      escapeCsvValue(row.maxStudents),
      escapeCsvValue(row.semester),
      escapeCsvValue(row.academicYear),
      escapeCsvValue(row.status)
    ];
    csvContent += values.join(',') + '\n';
  });

  // Download file
  downloadFile(csvContent, filename, 'text/csv');
};

/**
 * Export schedule to official CTU Daan Bantayan PDF format
 */
export const exportToOfficialPDF = (schedules, filters = {}) => {
  if (!schedules || schedules.length === 0) {
    toast('No schedules to export. Adjust the filters first.');
    return;
  }

  // Group schedules by section
  const grouped = {};
  schedules.forEach(schedule => {
    const key = `${schedule.program}-${schedule.yearLevel}-${schedule.section}`;
    if (!grouped[key]) {
      grouped[key] = {
        program: schedule.program,
        yearLevel: schedule.yearLevel,
        section: schedule.section,
        shift: schedule.shift || 'Day',
        semester: schedule.semester,
        academicYear: schedule.academicYear,
        schedules: []
      };
    }
    grouped[key].schedules.push(schedule);
  });

  // Build official HTML format
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Official Class Schedule - CTU Daanbantayan</title>
      <style>
        @page { 
          size: A4 landscape; 
          margin: 1.5cm 1cm;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body { 
          font-family: 'Arial', sans-serif; 
          font-size: 9pt;
          line-height: 1.3;
        }
        
        .page {
          page-break-after: always;
          padding: 10px;
        }
        
        .page:last-child {
          page-break-after: auto;
        }
        
        /* Header Section */
        .official-header {
          text-align: center;
          border-bottom: 3px solid #000;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        
        .official-header .logo-section {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 15px;
          margin-bottom: 8px;
        }
        
        .official-header .logo-placeholder {
          width: 60px;
          height: 60px;
          border: 2px solid #000;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 8pt;
        }
        
        .official-header h1 {
          font-size: 14pt;
          font-weight: bold;
          margin: 3px 0;
          text-transform: uppercase;
        }
        
        .official-header h2 {
          font-size: 11pt;
          font-weight: normal;
          margin: 2px 0;
        }
        
        .official-header .address {
          font-size: 8pt;
          color: #333;
          font-style: italic;
        }
        
        /* Schedule Info Bar */
        .schedule-info {
          display: flex;
          justify-content: space-between;
          background: #f0f0f0;
          padding: 8px 12px;
          border: 1px solid #000;
          margin-bottom: 10px;
          font-size: 9pt;
        }
        
        .schedule-info .info-item {
          display: flex;
          gap: 5px;
        }
        
        .schedule-info .info-label {
          font-weight: bold;
        }
        
        /* Timetable Grid */
        table.timetable { 
          width: 100%; 
          border-collapse: collapse;
          margin-bottom: 15px;
          table-layout: fixed;
        }
        
        table.timetable th,
        table.timetable td { 
          border: 1px solid #000; 
          padding: 6px 4px;
          text-align: center;
          vertical-align: top;
        }
        
        table.timetable th { 
          background-color: #1e3a8a;
          color: white;
          font-weight: bold;
          font-size: 9pt;
          text-transform: uppercase;
        }
        
        table.timetable .time-column {
          width: 80px;
          background-color: #f8f9fa;
          font-weight: bold;
          font-size: 8pt;
        }
        
        table.timetable td {
          font-size: 7.5pt;
          height: 50px;
        }
        
        .class-entry {
          margin-bottom: 3px;
          padding: 2px;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 2px;
        }
        
        .class-entry .subject-code {
          font-weight: bold;
          font-size: 8pt;
          color: #1e3a8a;
        }
        
        .class-entry .faculty-name {
          font-size: 7pt;
          color: #333;
        }
        
        .class-entry .room-info {
          font-size: 7pt;
          color: #666;
          font-style: italic;
        }
        
        /* Footer/Signature Section */
        .signature-section {
          margin-top: 30px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px;
          font-size: 9pt;
        }
        
        .signature-box {
          text-align: center;
        }
        
        .signature-line {
          border-top: 1px solid #000;
          margin-top: 40px;
          padding-top: 5px;
          font-weight: bold;
        }
        
        .signature-title {
          font-size: 7pt;
          color: #666;
          margin-top: 2px;
        }
        
        /* Print Footer */
        .print-footer {
          text-align: center;
          margin-top: 20px;
          padding-top: 10px;
          border-top: 1px solid #ccc;
          font-size: 7pt;
          color: #666;
        }
        
        /* Print controls */
        .no-print {
          position: fixed;
          top: 10px;
          right: 10px;
          z-index: 1000;
          background: white;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .no-print button {
          padding: 8px 16px;
          margin: 5px;
          cursor: pointer;
          border: none;
          border-radius: 4px;
          font-size: 10pt;
        }
        
        .btn-print {
          background: #1e3a8a;
          color: white;
        }
        
        .btn-close {
          background: #6B7280;
          color: white;
        }
        
        @media print {
          .no-print { display: none; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="no-print">
        <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
        <button class="btn-close" onclick="window.close()">✖ Close</button>
      </div>
  `;

  // Generate a page for each section
  Object.keys(grouped).forEach((key, index) => {
    const group = grouped[key];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Determine time slots based on shift
    const timeSlots = group.shift === 'Night' 
      ? generateNightTimeSlots() 
      : generateDayTimeSlots();

    html += `
      <div class="page">
        <!-- Official Header -->
        <div class="official-header">
          <div class="logo-section">
            <div class="logo-placeholder">CTU</div>
            <div>
              <h1>Cebu Technological University</h1>
              <h2>Daanbantayan Campus</h2>
              <p class="address">Poblacion, Daanbantayan, Cebu</p>
            </div>
          </div>
        </div>
        
        <!-- Schedule Information Bar -->
        <div class="schedule-info">
          <div class="info-item">
            <span class="info-label">Program:</span>
            <span>${group.program} Year ${group.yearLevel} - Section ${group.section}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Semester:</span>
            <span>${group.semester}</span>
          </div>
          <div class="info-item">
            <span class="info-label">A.Y.:</span>
            <span>${group.academicYear}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Shift:</span>
            <span>${group.shift}</span>
          </div>
        </div>
        
        <!-- Timetable Grid -->
        <table class="timetable">
          <thead>
            <tr>
              <th class="time-column">TIME</th>
              ${days.map(day => `<th>${day.toUpperCase()}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    // Generate rows for each time slot
    timeSlots.forEach(timeSlot => {
      html += `
        <tr>
          <td class="time-column">${timeSlot}</td>
      `;

      days.forEach(day => {
        const classesAtTime = findClassesInTimeSlot(group.schedules, day, timeSlot);
        html += '<td>';
        
        classesAtTime.forEach(cls => {
          html += `
            <div class="class-entry">
              <div class="subject-code">${cls.subject?.subjectCode || 'N/A'}</div>
              <div class="faculty-name">${cls.faculty?.user?.firstName || ''} ${cls.faculty?.user?.lastName || ''}</div>
              <div class="room-info">${cls.room?.roomNumber || 'TBA'}</div>
            </div>
          `;
        });
        
        html += '</td>';
      });

      html += '</tr>';
    });

    html += `
          </tbody>
        </table>
        
        <!-- Signature Section -->
        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line">_______________________</div>
            <div class="signature-title">Prepared by</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">_______________________</div>
            <div class="signature-title">Checked by</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">_______________________</div>
            <div class="signature-title">Approved by</div>
          </div>
        </div>
        
        <!-- Print Footer -->
        <div class="print-footer">
          Document generated on ${new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })} | CTU Daanbantayan Campus - Timetabling System
        </div>
      </div>
    `;
  });

  html += `
    </body>
    </html>
  `;

  // Open in new window
  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  printWindow.document.write(html);
  printWindow.document.close();
};

function generateDayTimeSlots() {
  return [
    '07:00-08:00',
    '08:00-09:00',
    '09:00-10:00',
    '10:00-11:00',
    '11:00-12:00',
    '12:00-13:00',
    '13:00-14:00',
    '14:00-15:00',
    '15:00-16:00'
  ];
}

function generateNightTimeSlots() {
  return [
    '16:00-17:00',
    '17:00-18:00',
    '18:00-19:00',
    '19:00-20:00',
    '20:00-21:00',
    '21:00-22:00'
  ];
}

function findClassesInTimeSlot(schedules, day, timeSlot) {
  const [startStr, endStr] = timeSlot.split('-');
  const [slotStartHour, slotStartMin] = startStr.split(':').map(Number);
  const [slotEndHour, slotEndMin] = endStr.split(':').map(Number);
  
  return schedules.filter(schedule => {
    if (!schedule.timeSlots) return false;
    
    return schedule.timeSlots.some(slot => {
      if (slot.day !== day) return false;
      
      const [classStartHour, classStartMin] = (slot.startTime || '').split(':').map(Number);
      const [classEndHour, classEndMin] = (slot.endTime || '').split(':').map(Number);
      
      // Check if class time overlaps with this slot
      const slotStart = slotStartHour * 60 + slotStartMin;
      const slotEnd = slotEndHour * 60 + slotEndMin;
      const classStart = classStartHour * 60 + classStartMin;
      const classEnd = classEndHour * 60 + classEndMin;
      
      return classStart < slotEnd && classEnd > slotStart;
    });
  });
}

/**
 * Export schedule to PDF-ready HTML format
 */
export const exportToPrintableHTML = (schedules, filters = {}) => {
  if (!schedules || schedules.length === 0) {
    toast('No schedules to export. Adjust the filters first.');
    return;
  }

  // Group schedules by section
  const grouped = {};
  schedules.forEach(schedule => {
    const key = `${schedule.program}-${schedule.yearLevel}-${schedule.section}`;
    if (!grouped[key]) {
      grouped[key] = {
        program: schedule.program,
        yearLevel: schedule.yearLevel,
        section: schedule.section,
        semester: schedule.semester,
        academicYear: schedule.academicYear,
        schedules: []
      };
    }
    grouped[key].schedules.push(schedule);
  });

  // Build HTML
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Class Schedule</title>
      <style>
        @page { size: landscape; margin: 1cm; }
        body { font-family: Arial, sans-serif; font-size: 10pt; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 18pt; }
        .header h2 { margin: 5px 0; font-size: 14pt; font-weight: normal; }
        .section-title { 
          background: #2563EB; 
          color: white; 
          padding: 8px; 
          margin: 20px 0 10px 0;
          font-size: 12pt;
          font-weight: bold;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        th, td { 
          border: 1px solid #ddd; 
          padding: 8px; 
          text-align: left; 
        }
        th { 
          background-color: #f8f9fa; 
          font-weight: bold; 
        }
        tr:nth-child(even) { background-color: #f8f9fa; }
        .time-cell { white-space: nowrap; }
        .footer { 
          text-align: center; 
          margin-top: 30px; 
          font-size: 9pt; 
          color: #666; 
        }
        @media print {
          .no-print { display: none; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <button class="no-print" onclick="window.print()" style="padding: 10px 20px; margin: 10px; cursor: pointer; background: #2563EB; color: white; border: none; border-radius: 4px;">
        Print / Save as PDF
      </button>
      <button class="no-print" onclick="window.close()" style="padding: 10px 20px; margin: 10px; cursor: pointer; background: #6B7280; color: white; border: none; border-radius: 4px;">
        Close
      </button>
  `;

  // Add content for each section
  Object.keys(grouped).forEach(key => {
    const group = grouped[key];
    
    html += `
      <div class="header">
        <h1>CTU-Daanbantayan - College of Teacher Education</h1>
        <h2>Class Schedule - ${group.program} Year ${group.yearLevel} Section ${group.section}</h2>
        <h2>Semester ${group.semester}, A.Y. ${group.academicYear}</h2>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Subject Code</th>
            <th>Subject Name</th>
            <th>Faculty</th>
            <th>Day</th>
            <th>Time</th>
            <th>Room</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
    `;

    group.schedules.forEach(schedule => {
      if (schedule.timeSlots && schedule.timeSlots.length > 0) {
        schedule.timeSlots.forEach((slot, idx) => {
          html += `
            <tr>
              ${idx === 0 ? `<td rowspan="${schedule.timeSlots.length}">${schedule.subject?.subjectCode || ''}</td>` : ''}
              ${idx === 0 ? `<td rowspan="${schedule.timeSlots.length}">${schedule.subject?.subjectName || ''}</td>` : ''}
              ${idx === 0 ? `<td rowspan="${schedule.timeSlots.length}">${schedule.faculty?.user?.firstName || ''} ${schedule.faculty?.user?.lastName || ''}</td>` : ''}
              <td>${slot.day || ''}</td>
              <td class="time-cell">${slot.startTime || ''} - ${slot.endTime || ''}</td>
              <td>${schedule.room?.roomNumber || ''}</td>
              <td>${slot.type || ''}</td>
            </tr>
          `;
        });
      }
    });

    html += `
        </tbody>
      </table>
    `;
  });

  html += `
      <div class="footer">
        Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
      </div>
    </body>
    </html>
  `;

  // Open in new window
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
};

/**
 * Export schedule to JSON format
 */
export const exportToJSON = (schedules, filename = 'schedule.json') => {
  if (!schedules || schedules.length === 0) {
    toast('No schedules to export. Adjust the filters first.');
    return;
  }

  const jsonContent = JSON.stringify(schedules, null, 2);
  downloadFile(jsonContent, filename, 'application/json');
};

/**
 * Export weekly timetable view (grid format)
 */
export const exportWeeklyTimetable = (schedules, filters = {}) => {
  if (!schedules || schedules.length === 0) {
    toast('No schedules to export. Adjust the filters first.');
    return;
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const timeSlots = generateTimeSlots();

  // Build timetable grid
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Weekly Timetable</title>
      <style>
        @page { size: landscape; margin: 0.5cm; }
        body { font-family: Arial, sans-serif; font-size: 8pt; }
        .header { text-align: center; margin-bottom: 15px; }
        .header h1 { margin: 0; font-size: 16pt; }
        .header h2 { margin: 5px 0; font-size: 12pt; font-weight: normal; }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          table-layout: fixed;
        }
        th, td { 
          border: 1px solid #000; 
          padding: 4px; 
          vertical-align: top;
          height: 50px;
        }
        th { 
          background-color: #2563EB; 
          color: white;
          font-weight: bold;
          text-align: center;
        }
        .time-col { 
          width: 80px; 
          background-color: #f8f9fa; 
          font-weight: bold;
          text-align: center;
        }
        .class-cell { 
          font-size: 7pt; 
          line-height: 1.2;
        }
        .subject-code { font-weight: bold; }
        .room { color: #666; }
        @media print {
          .no-print { display: none; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <button class="no-print" onclick="window.print()" style="padding: 8px 16px; margin: 10px; cursor: pointer; background: #2563EB; color: white; border: none; border-radius: 4px;">
        Print / Save as PDF
      </button>
      
      <div class="header">
        <h1>Weekly Timetable</h1>
        <h2>${filters.program || 'All Programs'} - Year ${filters.yearLevel || 'All'} - Semester ${filters.semester || 'All'}</h2>
        <h2>A.Y. ${filters.academicYear || 'Current'}</h2>
      </div>
      
      <table>
        <thead>
          <tr>
            <th class="time-col">Time</th>
            ${days.map(day => `<th>${day}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  // Generate grid
  timeSlots.forEach(time => {
    html += `<tr><td class="time-col">${time}</td>`;
    
    days.forEach(day => {
      const classesAtTime = findClassesAtTime(schedules, day, time);
      html += '<td>';
      
      classesAtTime.forEach(cls => {
        html += `
          <div class="class-cell">
            <div class="subject-code">${cls.subject?.subjectCode || ''}</div>
            <div>${cls.section || ''}</div>
            <div class="room">${cls.room?.roomNumber || ''}</div>
          </div>
        `;
      });
      
      html += '</td>';
    });
    
    html += '</tr>';
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
};

// Helper Functions

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function generateTimeSlots() {
  const slots = [];
  for (let hour = 7; hour <= 20; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
  }
  return slots;
}

function findClassesAtTime(schedules, day, time) {
  const [hour] = time.split(':').map(Number);
  
  return schedules.filter(schedule => {
    if (!schedule.timeSlots) return false;
    
    return schedule.timeSlots.some(slot => {
      if (slot.day !== day) return false;
      
      const [startHour] = (slot.startTime || '').split(':').map(Number);
      const [endHour] = (slot.endTime || '').split(':').map(Number);
      
      return hour >= startHour && hour < endHour;
    });
  });
}

export default {
  exportToCSV,
  exportToOfficialPDF,
  exportToPrintableHTML,
  exportToJSON,
  exportWeeklyTimetable
};
