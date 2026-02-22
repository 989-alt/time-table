import { v4 as uuidv4 } from 'uuid';

// Conflict type constants
export const CONFLICT_TYPES = {
    CLASS_OVERLAP: 'CLASS_OVERLAP',
    ROOM_OVERLAP: 'ROOM_OVERLAP',
    TEACHER_OVERLAP: 'TEACHER_OVERLAP',
    ROOM_CAPACITY_EXCEEDED: 'ROOM_CAPACITY_EXCEEDED',
    DAILY_MAX_EXCEEDED: 'DAILY_MAX_EXCEEDED',
    SAME_SUBJECT_SAME_DAY: 'SAME_SUBJECT_SAME_DAY'
};

// Conflict type labels in Korean
export const CONFLICT_LABELS = {
    [CONFLICT_TYPES.CLASS_OVERLAP]: '학급 시간 중복',
    [CONFLICT_TYPES.ROOM_OVERLAP]: '특별실 중복',
    [CONFLICT_TYPES.TEACHER_OVERLAP]: '교사 시간 중복',
    [CONFLICT_TYPES.ROOM_CAPACITY_EXCEEDED]: '특별실 정원 초과',
    [CONFLICT_TYPES.DAILY_MAX_EXCEEDED]: '일일 최대 교시 초과',
    [CONFLICT_TYPES.SAME_SUBJECT_SAME_DAY]: '같은 과목 비연속 배정'
};

// Constants for scoring - Updated Algorithm
const SCORES = {
    // Morning Priority (when toggle is ON)
    AM_PRIORITY_BONUS: 2000,      // Periods 1-4
    PM_PENALTY: -1000,            // Periods 5-6 penalty when morning priority is ON

    // Distribution - ensure at least 1 specialist per day per class
    DISTRIBUTION_BONUS: 3000,     // Class has no specialist subject on this day

    // Clustering - group same room on same day
    CLUSTER_BONUS: 1000,          // Adjacent same-grade same-room (vertical grouping)

    // Classroom fallback penalty (prefer special rooms)
    CLASSROOM_PENALTY: -1500,     // Penalty for using classroom instead of special room

    // Hard constraint violations
    PENALTY_INFINITE: -Infinity
};

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6];
const MAX_BLOCK_SIZE = 2; // Maximum consecutive periods for a block

/**
 * Decompose modules into scheduling units
 * Block logic: If isBlock=TRUE and hours>=2, create 2-hour units. Remaining become singles.
 * Max block size is 2.
 * Supports multiple locations per module (locations array).
 * @param {Array} teachers - Optional teachers array for teacher assignment
 */
export function decomposeModules(subjects, grades, teachers = []) {
    const units = [];

    subjects.forEach(subject => {
        const grade = grades.find(g => g.id === subject.gradeId);
        if (!grade) return;

        // For each class in the grade
        for (let classId = 1; classId <= grade.classCount; classId++) {
            subject.modules.forEach(module => {
                let remainingHours = module.weeklyHours;

                // Support both legacy location (string) and new locations (array)
                const availableLocations = module.locations && module.locations.length > 0
                    ? module.locations
                    : (module.location ? [module.location] : []);

                // Find teacher for this subject and class
                const teacher = teachers.find(t =>
                    t.subjectId === subject.id &&
                    t.gradeId === subject.gradeId &&
                    (t.assignedClasses || []).includes(classId)
                );

                // If hasBlock is true and hours >= 2, create block units (max size = 2)
                if (module.hasBlock && remainingHours >= MAX_BLOCK_SIZE) {
                    const blockUnits = Math.floor(remainingHours / MAX_BLOCK_SIZE);
                    for (let i = 0; i < blockUnits; i++) {
                        units.push({
                            id: uuidv4(),
                            gradeId: subject.gradeId,
                            gradeName: grade.name, // Store human-readable name
                            classId,
                            subjectName: subject.name,
                            moduleLocation: availableLocations[0] || '', // Default location (will be optimized)
                            availableLocations, // All available locations for this module
                            isBlock: true,
                            blockSize: MAX_BLOCK_SIZE,
                            subjectId: subject.id,
                            moduleId: module.id,
                            allowClassroomFallback: module.allowClassroomFallback || false,
                            teacherId: teacher?.id || null,
                            teacherName: teacher?.name || null,
                            duration: 1,
                            halfPeriodSlot: null
                        });
                        remainingHours -= MAX_BLOCK_SIZE;
                    }
                }

                // Create single units for remaining full hours
                while (remainingHours >= 1) {
                    units.push({
                        id: uuidv4(),
                        gradeId: subject.gradeId,
                        gradeName: grade.name, // Store human-readable name
                        classId,
                        subjectName: subject.name,
                        moduleLocation: availableLocations[0] || '', // Default location (will be optimized)
                        availableLocations, // All available locations for this module
                        isBlock: false,
                        blockSize: 1,
                        subjectId: subject.id,
                        moduleId: module.id,
                        allowClassroomFallback: module.allowClassroomFallback || false,
                        teacherId: teacher?.id || null,
                        teacherName: teacher?.name || null,
                        duration: 1,
                        halfPeriodSlot: null
                    });
                    remainingHours -= 1;
                }

                // Create half-period unit for remaining 0.5 hours
                if (remainingHours >= 0.5) {
                    units.push({
                        id: uuidv4(),
                        gradeId: subject.gradeId,
                        gradeName: grade.name,
                        classId,
                        subjectName: subject.name,
                        moduleLocation: availableLocations[0] || '',
                        availableLocations,
                        isBlock: false,
                        blockSize: 1,
                        subjectId: subject.id,
                        moduleId: module.id,
                        allowClassroomFallback: module.allowClassroomFallback || false,
                        teacherId: teacher?.id || null,
                        teacherName: teacher?.name || null,
                        duration: 0.5,
                        halfPeriodSlot: null  // Will be set during assignment ('first' or 'second')
                    });
                }
            });
        }
    });

    return units;
}

/**
 * Generate round-robin queue for fair grade distribution
 * Interleaves: Grade 1 -> Grade 2 -> ... -> Grade 6 -> repeat
 */
export function generateRoundRobinQueue(units) {
    // Group units by gradeId-classId
    const grouped = {};
    units.forEach(unit => {
        const key = `${unit.gradeId}-${unit.classId}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(unit);
    });

    const queue = [];
    const keys = Object.keys(grouped).sort((a, b) => {
        const [gradeA, classA] = a.split('-').map(Number);
        const [gradeB, classB] = b.split('-').map(Number);
        if (gradeA !== gradeB) return gradeA - gradeB;
        return classA - classB;
    });

    // Round-robin interleaving
    let hasMore = true;
    let index = 0;
    while (hasMore) {
        hasMore = false;
        for (const key of keys) {
            if (grouped[key].length > index) {
                queue.push(grouped[key][index]);
                hasMore = true;
            }
        }
        index++;
    }

    return queue;
}

/**
 * Check if a slot is valid (no conflicts)
 * @param {Array} specialRooms - Special rooms with capacity info (optional)
 * @param {string} halfSlot - 'first', 'second', or null for full period
 */
function isSlotValid(day, period, unit, assignments, grades, specialRooms = [], halfSlot = null) {
    // Check class overlap - same class can't have two things at same time
    // For half-period units, only conflict if same half-slot is occupied
    const classConflict = assignments.some(a => {
        if (a.gradeId !== unit.gradeId || a.classId !== unit.classId || a.day !== day || a.period !== period) {
            return false;
        }
        // Full period assignment blocks both halves
        if (!a.halfPeriodSlot && !halfSlot) return true;
        if (!a.halfPeriodSlot && halfSlot) return true;
        if (a.halfPeriodSlot && !halfSlot) return true;
        // Both are half-periods - only conflict if same slot
        return a.halfPeriodSlot === halfSlot;
    });
    if (classConflict) return false;

    // Skip room conflict check for '교실' (virtual classroom with unlimited capacity)
    if (unit.moduleLocation !== '교실') {
        // Find room capacity
        const roomInfo = specialRooms.find(r =>
            (typeof r === 'string' ? r : r.name) === unit.moduleLocation
        );
        const capacity = (roomInfo && typeof roomInfo === 'object') ? (roomInfo.capacity || 1) : 1;

        // Check room usage count at this time
        const roomUsageCount = assignments.filter(a =>
            a.moduleLocation === unit.moduleLocation &&
            a.day === day &&
            a.period === period
        ).length;

        if (roomUsageCount >= capacity) return false;
    }

    // Check daily max hours for grade
    const grade = grades.find(g => g.id === unit.gradeId);
    if (grade) {
        const dayIndex = DAYS.indexOf(day);
        const maxPeriods = grade.dailyMaxHours[dayIndex] || 6;
        if (period > maxPeriods) return false;
    }

    // Same subject same day constraint (unless it's part of a block being placed)
    // Prevent same Subject from appearing on same day UNLESS continuous block
    if (!unit.isBlock) {
        const sameSubjectSameDay = assignments.some(a =>
            a.gradeId === unit.gradeId &&
            a.classId === unit.classId &&
            a.subjectName === unit.subjectName &&
            a.day === day
        );
        if (sameSubjectSameDay) return false;
    }

    // Check teacher overlap if teacherId is set
    if (unit.teacherId) {
        const teacherConflict = assignments.some(a =>
            a.teacherId === unit.teacherId &&
            a.day === day &&
            a.period === period
        );
        if (teacherConflict) return false;
    }

    return true;
}

/**
 * Check if consecutive slots are available for block placement
 * @param {Array} specialRooms - Special rooms with capacity info (optional)
 */
function areConsecutiveSlotsValid(day, startPeriod, size, unit, assignments, grades, specialRooms = []) {
    for (let i = 0; i < size; i++) {
        const period = startPeriod + i;
        if (period > 6) return false;

        // For block validation, temporarily treat as non-block for individual slot checks
        const tempUnit = { ...unit, isBlock: false };
        if (i === 0) {
            // First slot - check normally but ignore same-subject-same-day for blocks
            const classConflict = assignments.some(a =>
                a.gradeId === unit.gradeId &&
                a.classId === unit.classId &&
                a.day === day &&
                a.period === period
            );
            if (classConflict) return false;

            // Skip room conflict check for '교실'
            if (unit.moduleLocation !== '교실') {
                // Find room capacity
                const roomInfo = specialRooms.find(r =>
                    (typeof r === 'string' ? r : r.name) === unit.moduleLocation
                );
                const capacity = (roomInfo && typeof roomInfo === 'object') ? (roomInfo.capacity || 1) : 1;

                const roomUsageCount = assignments.filter(a =>
                    a.moduleLocation === unit.moduleLocation &&
                    a.day === day &&
                    a.period === period
                ).length;

                if (roomUsageCount >= capacity) return false;
            }
        } else {
            if (!isSlotValid(day, period, tempUnit, assignments, grades, specialRooms)) return false;
        }
    }
    return true;
}

/**
 * Calculate score for a slot based on heuristics
 * @param {boolean} morningPriority - User preference for morning slots
 */
function scoreSlot(day, period, unit, assignments, grades, morningPriority = false) {
    let score = 0;

    // Morning Priority scoring
    if (morningPriority) {
        if (period <= 4) {
            score += SCORES.AM_PRIORITY_BONUS;
        } else {
            score += SCORES.PM_PENALTY;
        }
    } else {
        // Default: slight preference for earlier periods
        score += (7 - period) * 100;
    }

    // Distribution Bonus - ensure at least 1 specialist per day per class
    const hasSpecialistToday = assignments.some(a =>
        a.gradeId === unit.gradeId &&
        a.classId === unit.classId &&
        a.day === day
    );
    if (!hasSpecialistToday) {
        score += SCORES.DISTRIBUTION_BONUS;
    }

    // Cluster Bonus - group same room on same day (vertical grouping)
    const sameRoomSameDay = assignments.some(a =>
        a.moduleLocation === unit.moduleLocation &&
        a.gradeId === unit.gradeId &&
        a.day === day
    );
    if (sameRoomSameDay) {
        score += SCORES.CLUSTER_BONUS;
    }

    // Additional clustering: check for adjacent slots
    const adjacentSameRoom = assignments.some(a =>
        a.moduleLocation === unit.moduleLocation &&
        a.gradeId === unit.gradeId &&
        a.day === day &&
        (a.period === period - 1 || a.period === period + 1)
    );
    if (adjacentSameRoom) {
        score += SCORES.CLUSTER_BONUS * 0.5;
    }

    // Classroom penalty - prefer special rooms over classroom
    if (unit.moduleLocation === '교실') {
        score += SCORES.CLASSROOM_PENALTY;
    }

    return score;
}

/**
 * Find the best slot for a unit
 * @param {boolean} morningPriority - User preference for morning slots
 * Supports multiple locations - tries all available locations to find optimal slot
 * Adds '교실' as fallback when allowClassroomFallback is true
 */
function findBestSlot(unit, assignments, grades, morningPriority = false, specialRooms = []) {
    let bestSlot = null;
    let bestScore = -Infinity;
    let bestLocation = unit.moduleLocation;

    // Get available locations for this unit
    let locationsToTry = unit.availableLocations && unit.availableLocations.length > 0
        ? [...unit.availableLocations]
        : [unit.moduleLocation];

    // Add '교실' as fallback option if allowed
    if (unit.allowClassroomFallback && !locationsToTry.includes('교실')) {
        locationsToTry.push('교실');
    }

    // Try morning slots first if priority is on
    const periodsOrder = morningPriority
        ? [1, 2, 3, 4, 5, 6]  // Already in order
        : PERIODS;

    // Try each available location
    for (const location of locationsToTry) {
        // Create a temporary unit with this location
        const tempUnit = { ...unit, moduleLocation: location };

        for (const day of DAYS) {
            for (const period of periodsOrder) {
                if (tempUnit.isBlock) {
                    // For blocks, check consecutive slots
                    if (!areConsecutiveSlotsValid(day, period, tempUnit.blockSize, tempUnit, assignments, grades, specialRooms)) {
                        continue;
                    }
                    const score = scoreSlot(day, period, tempUnit, assignments, grades, morningPriority);
                    if (score > bestScore) {
                        bestScore = score;
                        bestSlot = { day, period };
                        bestLocation = location;
                    }
                } else {
                    // For single units (including half-period)
                    if (tempUnit.duration === 0.5) {
                        // Try first half, then second half
                        for (const halfSlot of ['first', 'second']) {
                            if (!isSlotValid(day, period, tempUnit, assignments, grades, specialRooms, halfSlot)) {
                                continue;
                            }
                            const score = scoreSlot(day, period, tempUnit, assignments, grades, morningPriority);
                            if (score > bestScore) {
                                bestScore = score;
                                bestSlot = { day, period, halfPeriodSlot: halfSlot };
                                bestLocation = location;
                            }
                        }
                    } else {
                        if (!isSlotValid(day, period, tempUnit, assignments, grades, specialRooms)) {
                            continue;
                        }
                        const score = scoreSlot(day, period, tempUnit, assignments, grades, morningPriority);
                        if (score > bestScore) {
                            bestScore = score;
                            bestSlot = { day, period, halfPeriodSlot: null };
                            bestLocation = location;
                        }
                    }
                }
            }
        }
    }

    // Return slot with best location
    if (bestSlot) {
        return { ...bestSlot, location: bestLocation };
    }
    return null;
}

/**
 * Main scheduler function - Fail-Safe Linear Solver
 * @param {boolean} morningPriority - User preference for morning slots
 * @param {Array} specialRooms - Special rooms with capacity info (optional)
 * @param {Array} teachers - Teachers array for teacher assignment (optional)
 */
export function runAutoScheduler(subjects, grades, existingAssignments = [], morningPriority = false, specialRooms = [], teachers = []) {
    // Step 1: Pre-processing - decompose modules into units
    const units = decomposeModules(subjects, grades, teachers);

    // Step 2: Generate round-robin queue (Grade 1 -> Grade 2 -> ... fairness)
    const queue = generateRoundRobinQueue(units);

    // Step 3-5: Linear slot search and assignment (Fail-Safe)
    const newAssignments = [...existingAssignments];
    let successCount = 0;
    let failureCount = 0;
    const failedUnits = [];

    for (const unit of queue) {
        const bestSlot = findBestSlot(unit, newAssignments, grades, morningPriority, specialRooms);

        if (bestSlot) {
            // Use the optimized location from findBestSlot
            const assignedLocation = bestSlot.location || unit.moduleLocation;

            if (unit.isBlock) {
                // Place block units (consecutive periods, max 2)
                for (let i = 0; i < unit.blockSize; i++) {
                    newAssignments.push({
                        id: uuidv4(),
                        gradeId: unit.gradeId,
                        gradeName: unit.gradeName, // Human-readable grade name
                        classId: unit.classId,
                        subjectName: unit.subjectName,
                        moduleLocation: assignedLocation,
                        day: bestSlot.day,
                        period: bestSlot.period + i,
                        isBlockPart: true,
                        blockIndex: i,
                        teacherId: unit.teacherId || null,
                        teacherName: unit.teacherName || null,
                        duration: 1,
                        halfPeriodSlot: null
                    });
                }
            } else {
                // Place single unit (including half-period)
                newAssignments.push({
                    id: uuidv4(),
                    gradeId: unit.gradeId,
                    gradeName: unit.gradeName, // Human-readable grade name
                    classId: unit.classId,
                    subjectName: unit.subjectName,
                    moduleLocation: assignedLocation,
                    day: bestSlot.day,
                    period: bestSlot.period,
                    isBlockPart: false,
                    teacherId: unit.teacherId || null,
                    teacherName: unit.teacherName || null,
                    duration: unit.duration || 1,
                    halfPeriodSlot: bestSlot.halfPeriodSlot || null
                });
            }
            successCount++;
        } else {
            failureCount++;
            // Store detailed failure info for reporting
            failedUnits.push({
                gradeId: unit.gradeId,
                gradeName: unit.gradeName,
                classId: unit.classId,
                subjectName: unit.subjectName
            });
        }
    }

    return {
        assignments: newAssignments,
        successCount,
        failureCount,
        totalUnits: queue.length,
        failedUnits
    };
}

/**
 * Validate assignments for conflicts
 * @param {Array} assignments - All assignments
 * @param {Array} grades - Grade data for daily max hours check
 * @param {Array} specialRooms - Special rooms with capacity info (optional)
 * @returns {Array} Array of conflict objects with type, message, assignments, and location info
 */
export function validateAssignments(assignments, grades = [], specialRooms = []) {
    const conflicts = [];

    // Helper to get grade name
    const getGradeName = (assignment) => {
        if (assignment.gradeName) {
            return assignment.gradeName.replace('학년', '').trim();
        }
        const grade = grades.find(g => g.id === assignment.gradeId);
        return grade ? grade.name.replace('학년', '').trim() : '?';
    };

    // Check for class overlaps (same class, same time)
    const classSlots = {};
    assignments.forEach(a => {
        const key = `${a.gradeId}-${a.classId}-${a.day}-${a.period}`;
        if (classSlots[key]) {
            const gradeName = getGradeName(a);
            conflicts.push({
                type: CONFLICT_TYPES.CLASS_OVERLAP,
                message: `${gradeName}-${a.classId}반: ${a.day}요일 ${a.period}교시에 중복 배정`,
                assignments: [classSlots[key], a],
                day: a.day,
                period: a.period,
                gradeId: a.gradeId,
                classId: a.classId
            });
        } else {
            classSlots[key] = a;
        }
    });

    // Check for room overlaps (same room, same time) - with capacity support
    const roomSlots = {};
    assignments.forEach(a => {
        // Skip classroom (virtual room with unlimited capacity)
        if (a.moduleLocation === '교실') return;

        const key = `${a.moduleLocation}-${a.day}-${a.period}`;
        if (!roomSlots[key]) {
            roomSlots[key] = [];
        }
        roomSlots[key].push(a);
    });

    Object.entries(roomSlots).forEach(([key, items]) => {
        // Find room capacity (default: 1)
        const roomName = items[0].moduleLocation;
        const roomInfo = specialRooms.find(r =>
            (typeof r === 'string' ? r : r.name) === roomName
        );
        const capacity = (roomInfo && typeof roomInfo === 'object') ? (roomInfo.capacity || 1) : 1;

        if (items.length > capacity) {
            const gradeName = getGradeName(items[0]);
            conflicts.push({
                type: capacity > 1 ? CONFLICT_TYPES.ROOM_CAPACITY_EXCEEDED : CONFLICT_TYPES.ROOM_OVERLAP,
                message: capacity > 1
                    ? `${roomName}: ${items[0].day}요일 ${items[0].period}교시에 정원(${capacity}) 초과 (${items.length}학급)`
                    : `${roomName}: ${items[0].day}요일 ${items[0].period}교시에 다른 학급과 중복`,
                assignments: items,
                day: items[0].day,
                period: items[0].period,
                room: roomName
            });
        }
    });

    // Check for teacher overlaps (same teacher, same time)
    const teacherSlots = {};
    assignments.forEach(a => {
        if (!a.teacherId) return;
        const key = `${a.teacherId}-${a.day}-${a.period}`;
        if (teacherSlots[key]) {
            const existing = teacherSlots[key];
            if (existing.gradeId !== a.gradeId || existing.classId !== a.classId) {
                conflicts.push({
                    type: CONFLICT_TYPES.TEACHER_OVERLAP,
                    message: `${a.teacherName || '교사'}: ${a.day}요일 ${a.period}교시에 다른 학급과 중복`,
                    assignments: [existing, a],
                    day: a.day,
                    period: a.period,
                    teacherId: a.teacherId
                });
            }
        } else {
            teacherSlots[key] = a;
        }
    });

    // Check for daily max hours exceeded
    if (grades.length > 0) {
        const gradeClassDayCounts = {};
        assignments.forEach(a => {
            const key = `${a.gradeId}-${a.classId}-${a.day}`;
            if (!gradeClassDayCounts[key]) {
                gradeClassDayCounts[key] = { assignments: [], maxPeriod: 0 };
            }
            gradeClassDayCounts[key].assignments.push(a);
            if (a.period > gradeClassDayCounts[key].maxPeriod) {
                gradeClassDayCounts[key].maxPeriod = a.period;
            }
        });

        Object.entries(gradeClassDayCounts).forEach(([key, data]) => {
            const [gradeId, classId, day] = key.split('-');
            const grade = grades.find(g => g.id === gradeId);
            if (grade) {
                const dayIndex = DAYS.indexOf(day);
                const maxHours = grade.dailyMaxHours?.[dayIndex] || 6;
                if (data.maxPeriod > maxHours) {
                    const gradeName = grade.name.replace('학년', '').trim();
                    conflicts.push({
                        type: CONFLICT_TYPES.DAILY_MAX_EXCEEDED,
                        message: `${gradeName}-${classId}반: ${day}요일 ${data.maxPeriod}교시 배정 (최대 ${maxHours}교시)`,
                        assignments: data.assignments.filter(a => a.period > maxHours),
                        day,
                        gradeId,
                        classId: parseInt(classId)
                    });
                }
            }
        });
    }

    // Check for same subject on same day (non-consecutive / non-block)
    const subjectDays = {};
    assignments.forEach(a => {
        const key = `${a.gradeId}-${a.classId}-${a.subjectName}-${a.day}`;
        if (!subjectDays[key]) {
            subjectDays[key] = [];
        }
        subjectDays[key].push(a);
    });

    Object.entries(subjectDays).forEach(([key, items]) => {
        if (items.length > 1) {
            // Check if they are consecutive (allowed for blocks)
            items.sort((a, b) => a.period - b.period);
            for (let i = 1; i < items.length; i++) {
                if (items[i].period - items[i - 1].period > 1) {
                    const gradeName = getGradeName(items[0]);
                    conflicts.push({
                        type: CONFLICT_TYPES.SAME_SUBJECT_SAME_DAY,
                        message: `${gradeName}-${items[0].classId}반: ${items[0].subjectName}이(가) ${items[0].day}요일에 비연속 배정`,
                        assignments: items,
                        day: items[0].day,
                        gradeId: items[0].gradeId,
                        classId: items[0].classId
                    });
                    break;
                }
            }
        }
    });

    return conflicts;
}

/**
 * Get subject color class based on location
 */
export function getSubjectColorClass(location) {
    const colorMap = {
        '체육관': 'subject-sports',
        '운동장': 'subject-sports',
        '과학실': 'subject-science',
        '영어실': 'subject-english',
        '음악실': 'subject-music',
        '실과실': 'subject-practical',
        '컴퓨터실': 'subject-default',
        '교실': 'subject-classroom'  // Classroom fallback style
    };
    return colorMap[location] || 'subject-default';
}

export { DAYS, PERIODS, MAX_BLOCK_SIZE };
