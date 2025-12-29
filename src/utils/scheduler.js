import { v4 as uuidv4 } from 'uuid';

// Constants for scoring - Updated Algorithm
const SCORES = {
    // Morning Priority (when toggle is ON)
    AM_PRIORITY_BONUS: 2000,      // Periods 1-4
    PM_PENALTY: -1000,            // Periods 5-6 penalty when morning priority is ON

    // Distribution - ensure at least 1 specialist per day per class
    DISTRIBUTION_BONUS: 3000,     // Class has no specialist subject on this day

    // Clustering - group same room on same day
    CLUSTER_BONUS: 1000,          // Adjacent same-grade same-room (vertical grouping)

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
 */
export function decomposeModules(subjects, grades) {
    const units = [];

    subjects.forEach(subject => {
        const grade = grades.find(g => g.id === subject.gradeId);
        if (!grade) return;

        // For each class in the grade
        for (let classId = 1; classId <= grade.classCount; classId++) {
            subject.modules.forEach(module => {
                let remainingHours = module.weeklyHours;

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
                            moduleLocation: module.location,
                            isBlock: true,
                            blockSize: MAX_BLOCK_SIZE,
                            subjectId: subject.id,
                            moduleId: module.id
                        });
                        remainingHours -= MAX_BLOCK_SIZE;
                    }
                }

                // Create single units for remaining hours
                for (let i = 0; i < remainingHours; i++) {
                    units.push({
                        id: uuidv4(),
                        gradeId: subject.gradeId,
                        gradeName: grade.name, // Store human-readable name
                        classId,
                        subjectName: subject.name,
                        moduleLocation: module.location,
                        isBlock: false,
                        blockSize: 1,
                        subjectId: subject.id,
                        moduleId: module.id
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
 */
function isSlotValid(day, period, unit, assignments, grades) {
    // Check class overlap - same class can't have two things at same time
    const classConflict = assignments.some(a =>
        a.gradeId === unit.gradeId &&
        a.classId === unit.classId &&
        a.day === day &&
        a.period === period
    );
    if (classConflict) return false;

    // Check room overlap - same room can't be used by different classes at same time
    const roomConflict = assignments.some(a =>
        a.moduleLocation === unit.moduleLocation &&
        a.day === day &&
        a.period === period &&
        (a.gradeId !== unit.gradeId || a.classId !== unit.classId)
    );
    if (roomConflict) return false;

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

    return true;
}

/**
 * Check if consecutive slots are available for block placement
 */
function areConsecutiveSlotsValid(day, startPeriod, size, unit, assignments, grades) {
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

            const roomConflict = assignments.some(a =>
                a.moduleLocation === unit.moduleLocation &&
                a.day === day &&
                a.period === period &&
                (a.gradeId !== unit.gradeId || a.classId !== unit.classId)
            );
            if (roomConflict) return false;
        } else {
            if (!isSlotValid(day, period, tempUnit, assignments, grades)) return false;
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

    return score;
}

/**
 * Find the best slot for a unit
 * @param {boolean} morningPriority - User preference for morning slots
 */
function findBestSlot(unit, assignments, grades, morningPriority = false) {
    let bestSlot = null;
    let bestScore = -Infinity;

    // Try morning slots first if priority is on
    const periodsOrder = morningPriority
        ? [1, 2, 3, 4, 5, 6]  // Already in order
        : PERIODS;

    for (const day of DAYS) {
        for (const period of periodsOrder) {
            if (unit.isBlock) {
                // For blocks, check consecutive slots
                if (!areConsecutiveSlotsValid(day, period, unit.blockSize, unit, assignments, grades)) {
                    continue;
                }
                const score = scoreSlot(day, period, unit, assignments, grades, morningPriority);
                if (score > bestScore) {
                    bestScore = score;
                    bestSlot = { day, period };
                }
            } else {
                // For single units
                if (!isSlotValid(day, period, unit, assignments, grades)) {
                    continue;
                }
                const score = scoreSlot(day, period, unit, assignments, grades, morningPriority);
                if (score > bestScore) {
                    bestScore = score;
                    bestSlot = { day, period };
                }
            }
        }
    }

    return bestSlot;
}

/**
 * Main scheduler function - Fail-Safe Linear Solver
 * @param {boolean} morningPriority - User preference for morning slots
 */
export function runAutoScheduler(subjects, grades, existingAssignments = [], morningPriority = false) {
    // Step 1: Pre-processing - decompose modules into units
    const units = decomposeModules(subjects, grades);

    // Step 2: Generate round-robin queue (Grade 1 -> Grade 2 -> ... fairness)
    const queue = generateRoundRobinQueue(units);

    // Step 3-5: Linear slot search and assignment (Fail-Safe)
    const newAssignments = [...existingAssignments];
    let successCount = 0;
    let failureCount = 0;
    const failedUnits = [];

    for (const unit of queue) {
        const bestSlot = findBestSlot(unit, newAssignments, grades, morningPriority);

        if (bestSlot) {
            if (unit.isBlock) {
                // Place block units (consecutive periods, max 2)
                for (let i = 0; i < unit.blockSize; i++) {
                    newAssignments.push({
                        id: uuidv4(),
                        gradeId: unit.gradeId,
                        gradeName: unit.gradeName, // Human-readable grade name
                        classId: unit.classId,
                        subjectName: unit.subjectName,
                        moduleLocation: unit.moduleLocation,
                        day: bestSlot.day,
                        period: bestSlot.period + i,
                        isBlockPart: true,
                        blockIndex: i
                    });
                }
            } else {
                // Place single unit
                newAssignments.push({
                    id: uuidv4(),
                    gradeId: unit.gradeId,
                    gradeName: unit.gradeName, // Human-readable grade name
                    classId: unit.classId,
                    subjectName: unit.subjectName,
                    moduleLocation: unit.moduleLocation,
                    day: bestSlot.day,
                    period: bestSlot.period,
                    isBlockPart: false
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
 */
export function validateAssignments(assignments) {
    const conflicts = [];

    // Check for class overlaps (same class, same time)
    const classSlots = {};
    assignments.forEach(a => {
        const key = `${a.gradeId}-${a.classId}-${a.day}-${a.period}`;
        if (classSlots[key]) {
            conflicts.push({
                type: 'CLASS_OVERLAP',
                message: `${a.gradeId}학년 ${a.classId}반: ${a.day}요일 ${a.period}교시에 중복 배정`,
                assignments: [classSlots[key], a]
            });
        } else {
            classSlots[key] = a;
        }
    });

    // Check for room overlaps (same room, same time, different class)
    const roomSlots = {};
    assignments.forEach(a => {
        const key = `${a.moduleLocation}-${a.day}-${a.period}`;
        if (roomSlots[key]) {
            const existing = roomSlots[key];
            if (existing.gradeId !== a.gradeId || existing.classId !== a.classId) {
                conflicts.push({
                    type: 'ROOM_OVERLAP',
                    message: `${a.moduleLocation}: ${a.day}요일 ${a.period}교시에 다른 학급과 중복`,
                    assignments: [existing, a]
                });
            }
        } else {
            roomSlots[key] = a;
        }
    });

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
                    conflicts.push({
                        type: 'SAME_SUBJECT_SAME_DAY',
                        message: `${items[0].gradeId}학년 ${items[0].classId}반: ${items[0].subjectName}이(가) ${items[0].day}요일에 비연속 배정`,
                        assignments: items
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
        '컴퓨터실': 'subject-default'
    };
    return colorMap[location] || 'subject-default';
}

export { DAYS, PERIODS, MAX_BLOCK_SIZE };
