/**
 * Diagnostic Script: Check Why OR-TOOLS Returns INFEASIBLE
 * 
 * This script checks all the constraints that could cause INFEASIBLE:
 * 1. Room availability vs requirements
 * 2. Faculty workload capacity vs requirements
 * 3. Time slot capacity vs hours needed
 * 4. Existing schedules blocking new generation
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Subject = require('./models/Subject.model');
const Faculty = require('./models/Faculty.model');
const Room = require('./models/Room.model');
const Schedule = require('./models/Schedule.model');

async function diagnoseSchedulerIssues() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Configuration: Change these to match your test case
    const TEST_CONFIG = {
      program: 'ACT',  // Change to the program you're testing
      yearLevel: 1,
      semester: 1,
      academicYear: '2024-2025',
      shift: 'Day'
    };

    console.log('═══════════════════════════════════════════');
    console.log('🔍 DIAGNOSING SCHEDULER INFEASIBILITY');
    console.log('═══════════════════════════════════════════\n');
    console.log('Test Configuration:');
    console.log(`  Program: ${TEST_CONFIG.program}`);
    console.log(`  Year Level: ${TEST_CONFIG.yearLevel}`);
    console.log(`  Semester: ${TEST_CONFIG.semester}`);
    console.log(`  Academic Year: ${TEST_CONFIG.academicYear}`);
    console.log(`  Shift: ${TEST_CONFIG.shift}\n`);

    // ============================================================
    // CHECK 1: SUBJECTS TO SCHEDULE
    // ============================================================
    console.log('───────────────────────────────────────────');
    console.log('📚 CHECK 1: SUBJECTS TO SCHEDULE');
    console.log('───────────────────────────────────────────');
    
    const subjects = await Subject.find({
      program: TEST_CONFIG.program,
      yearLevel: TEST_CONFIG.yearLevel,
      semester: TEST_CONFIG.semester,
      isActive: true
    });

    console.log(`Found ${subjects.length} active subjects:\n`);
    
    let totalLectureHours = 0;
    let totalLabHours = 0;
    let totalUnits = 0;
    let nstpCount = 0;

    subjects.forEach((s, i) => {
      const lec = s.lectureHours || 0;
      const lab = s.labHours || 0;
      const units = s.units || 3;
      const isNSTP = /NSTP/i.test(s.subjectCode) || /NSTP/i.test(s.subjectName);
      
      if (isNSTP) nstpCount++;
      
      totalLectureHours += lec;
      totalLabHours += lab;
      totalUnits += units;
      
      console.log(`  ${i + 1}. ${s.subjectCode} - ${s.subjectName}`);
      console.log(`     Lecture: ${lec}h | Lab: ${lab}h | Units: ${units} | ${isNSTP ? '🎯 NSTP' : ''}`);
    });

    console.log(`\n  TOTALS:`);
    console.log(`    Lecture Hours: ${totalLectureHours}h`);
    console.log(`    Lab Hours: ${totalLabHours}h`);
    console.log(`    Total Teaching Hours: ${totalLectureHours + totalLabHours}h`);
    console.log(`    Total Units: ${totalUnits}`);
    console.log(`    NSTP Subjects: ${nstpCount}`);

    // ============================================================
    // CHECK 2: TIME SLOT CAPACITY
    // ============================================================
    console.log('\n───────────────────────────────────────────');
    console.log('⏰ CHECK 2: TIME SLOT CAPACITY');
    console.log('───────────────────────────────────────────');
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const slotsPerDay = TEST_CONFIG.shift === 'Day' ? 7 : 4; // Day: 7AM-5PM, Night: 5PM-9PM
    const breakHours = 1; // Lunch break
    const teachingHoursPerDay = slotsPerDay - breakHours;
    const totalCapacityHours = teachingHoursPerDay * days.length;

    console.log(`  Days: ${days.length} (${days.join(', ')})`);
    console.log(`  Slots per day: ${slotsPerDay}`);
    console.log(`  Break hours: ${breakHours}`);
    console.log(`  Teaching hours per day: ${teachingHoursPerDay}`);
    console.log(`  Total capacity: ${totalCapacityHours} hours`);
    console.log(`  Required hours: ${totalLectureHours + totalLabHours} hours`);
    
    const capacityUtilization = ((totalLectureHours + totalLabHours) / totalCapacityHours * 100).toFixed(1);
    console.log(`  Capacity utilization: ${capacityUtilization}%`);
    
    if (totalLectureHours + totalLabHours > totalCapacityHours) {
      console.log(`  ❌ PROBLEM: Not enough time slots! Need ${(totalLectureHours + totalLabHours) - totalCapacityHours} more hours.`);
    } else {
      console.log(`  ✅ Time slots: Sufficient`);
    }

    // ============================================================
    // CHECK 3: ROOM AVAILABILITY
    // ============================================================
    console.log('\n───────────────────────────────────────────');
    console.log('🏫 CHECK 3: ROOM AVAILABILITY');
    console.log('───────────────────────────────────────────');
    
    const rooms = await Room.find({ isActive: true });
    
    const roomsByType = {};
    rooms.forEach(r => {
      const type = r.roomType || 'Unknown';
      if (!roomsByType[type]) roomsByType[type] = [];
      roomsByType[type].push(r);
    });

    console.log(`  Total rooms: ${rooms.length}\n`);
    
    Object.entries(roomsByType).forEach(([type, roomList]) => {
      console.log(`  ${type}: ${roomList.length} rooms`);
      roomList.slice(0, 3).forEach(r => {
        console.log(`    - ${r.roomCode} (Capacity: ${r.capacity || 'N/A'})`);
      });
      if (roomList.length > 3) {
        console.log(`    ... and ${roomList.length - 3} more`);
      }
    });

    const roomCapacityHours = rooms.length * totalCapacityHours;
    const roomUtilization = ((totalLectureHours + totalLabHours) / roomCapacityHours * 100).toFixed(1);
    
    console.log(`\n  Room capacity: ${roomCapacityHours} room-hours`);
    console.log(`  Required: ${totalLectureHours + totalLabHours} room-hours`);
    console.log(`  Room utilization: ${roomUtilization}%`);
    
    if (totalLectureHours + totalLabHours > roomCapacityHours) {
      console.log(`  ❌ PROBLEM: Not enough rooms!`);
    } else {
      console.log(`  ✅ Rooms: Sufficient`);
    }

    // Check lab requirements
    const labSubjects = subjects.filter(s => s.labHours > 0 || s.needsLab);
    const labRooms = rooms.filter(r => 
      r.roomType === 'Laboratory' || 
      r.roomType === 'Computer Lab' || 
      r.roomType === 'Workshop'
    );

    console.log(`\n  Lab requirements:`);
    console.log(`    Subjects needing lab: ${labSubjects.length}`);
    console.log(`    Lab rooms available: ${labRooms.length}`);
    
    if (labSubjects.length > 0 && labRooms.length === 0) {
      console.log(`    ❌ PROBLEM: No lab rooms available for ${labSubjects.length} lab subjects!`);
    }

    // ============================================================
    // CHECK 4: FACULTY AVAILABILITY
    // ============================================================
    console.log('\n───────────────────────────────────────────');
    console.log('👨‍🏫 CHECK 4: FACULTY AVAILABILITY');
    console.log('───────────────────────────────────────────');
    
    const faculty = await Faculty.find({
      status: 'Active',
      $or: [
        { programs: TEST_CONFIG.program },
        { programs: { $exists: false } },
        { programs: { $size: 0 } }
      ]
    }).populate('user');

    console.log(`  Total active faculty for ${TEST_CONFIG.program}: ${faculty.length}\n`);

    let totalMaxLoad = 0;
    let totalCurrentLoad = 0;
    
    faculty.forEach((f, i) => {
      const name = f.user ? `${f.user.firstName} ${f.user.lastName}` : f.employeeId;
      const maxLoad = f.maxTeachingLoad || 24;
      const currentLoad = f.currentLoad || 0;
      const available = maxLoad - currentLoad;
      
      totalMaxLoad += maxLoad;
      totalCurrentLoad += currentLoad;
      
      if (i < 5) {  // Show first 5
        console.log(`  ${i + 1}. ${name}`);
        console.log(`     Max: ${maxLoad} | Current: ${currentLoad} | Available: ${available} units`);
        if (f.specializations && f.specializations.length > 0) {
          console.log(`     Specializations: ${f.specializations.join(', ')}`);
        }
      }
    });

    if (faculty.length > 5) {
      console.log(`  ... and ${faculty.length - 5} more faculty members`);
    }

    const totalAvailableLoad = totalMaxLoad - totalCurrentLoad;
    
    console.log(`\n  TOTALS:`);
    console.log(`    Total max load: ${totalMaxLoad} units`);
    console.log(`    Total current load: ${totalCurrentLoad} units`);
    console.log(`    Total available: ${totalAvailableLoad} units`);
    console.log(`    Required units: ${totalUnits} units`);
    
    const facultyUtilization = (totalUnits / totalAvailableLoad * 100).toFixed(1);
    console.log(`    Faculty utilization: ${facultyUtilization}%`);
    
    if (totalUnits > totalAvailableLoad) {
      console.log(`    ❌ PROBLEM: Faculty capacity insufficient by ${totalUnits - totalAvailableLoad} units!`);
    } else {
      console.log(`    ✅ Faculty capacity: Sufficient`);
    }

    // ============================================================
    // CHECK 5: EXISTING SCHEDULES
    // ============================================================
    console.log('\n───────────────────────────────────────────');
    console.log('📅 CHECK 5: EXISTING SCHEDULES');
    console.log('───────────────────────────────────────────');
    
    const existingSchedules = await Schedule.find({
      program: TEST_CONFIG.program,
      yearLevel: TEST_CONFIG.yearLevel,
      semester: TEST_CONFIG.semester,
      academicYear: TEST_CONFIG.academicYear,
      status: 'active'
    }).populate('subject faculty room');

    console.log(`  Existing active schedules: ${existingSchedules.length}\n`);

    if (existingSchedules.length > 0) {
      console.log(`  ⚠️  WARNING: There are already ${existingSchedules.length} active schedules!`);
      console.log(`  This may limit available time slots for new generation.`);
      
      const existingSubjects = new Set();
      existingSchedules.forEach(s => {
        if (s.subject) {
          existingSubjects.add(s.subject.subjectCode);
        }
      });
      
      console.log(`\n  Already scheduled subjects:`);
      existingSubjects.forEach(code => {
        console.log(`    - ${code}`);
      });
    } else {
      console.log(`  ✅ No conflicting schedules`);
    }

    // ============================================================
    // SUMMARY & RECOMMENDATIONS
    // ============================================================
    console.log('\n═══════════════════════════════════════════');
    console.log('📋 SUMMARY & RECOMMENDATIONS');
    console.log('═══════════════════════════════════════════\n');

    const issues = [];

    if (subjects.length === 0) {
      issues.push('❌ No active subjects found for this program/year/semester');
    }

    if (totalLectureHours + totalLabHours > totalCapacityHours) {
      issues.push(`❌ Insufficient time slots (need ${(totalLectureHours + totalLabHours) - totalCapacityHours} more hours)`);
    }

    if (totalLectureHours + totalLabHours > roomCapacityHours) {
      issues.push('❌ Insufficient room capacity');
    }

    if (labSubjects.length > 0 && labRooms.length === 0) {
      issues.push('❌ No lab rooms available for lab subjects');
    }

    if (totalUnits > totalAvailableLoad) {
      issues.push(`❌ Insufficient faculty capacity (need ${totalUnits - totalAvailableLoad} more units)`);
    }

    if (faculty.length === 0) {
      issues.push('❌ No active faculty members found for this program');
    }

    if (rooms.length === 0) {
      issues.push('❌ No active rooms found');
    }

    if (issues.length === 0) {
      console.log('✅ All basic constraints appear satisfied!');
      console.log('\nThe INFEASIBLE error may be caused by:');
      console.log('  1. Faculty unavailability conflicts (check faculty unavailable times)');
      console.log('  2. Too many subjects with specific requirements (all need labs, specific rooms)');
      console.log('  3. NSTP Saturday constraint too restrictive (if multiple NSTP sections)');
      console.log('  4. Existing schedules blocking critical time slots');
      console.log('\nSuggestions:');
      console.log('  - Try increasing optimization time limit (60s → 120s)');
      console.log('  - Check faculty unavailable times in database');
      console.log('  - Temporarily deactivate existing schedules if regenerating');
    } else {
      console.log('⚠️  ISSUES DETECTED:\n');
      issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
      
      console.log('\nRECOMMENDED ACTIONS:');
      if (faculty.length === 0 || totalUnits > totalAvailableLoad) {
        console.log('  - Add more faculty members or increase max_teaching_load');
      }
      if (rooms.length === 0 || totalLectureHours + totalLabHours > roomCapacityHours) {
        console.log('  - Add more rooms');
      }
      if (labSubjects.length > 0 && labRooms.length === 0) {
        console.log('  - Add laboratory/computer lab rooms');
      }
      if (totalLectureHours + totalLabHours > totalCapacityHours) {
        console.log('  - Add more days (enable Sunday) or extend shift hours');
        console.log('  - Reduce lecture/lab hours for some subjects');
      }
    }

    console.log('\n═══════════════════════════════════════════\n');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
  }
}

diagnoseSchedulerIssues();
