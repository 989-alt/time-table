import React, { useState } from 'react';
import { School, AlertTriangle } from 'lucide-react';
import { DAYS, PERIODS, getSubjectColorClass, CONFLICT_TYPES } from '../utils/scheduler';

export default function TimetableGrid({
    assignments,
    setAssignments,
    gradeId,
    classId,
    dailyMaxHours,
    conflictCells = [],
    filterRoom = null,
    grades = []
}) {
    const [draggedItem, setDraggedItem] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [hoverConflict, setHoverConflict] = useState(null); // For real-time conflict overlay

    // Helper: Get human-readable grade-class format (e.g., "6-1")
    const formatGradeClass = (assignment) => {
        if (assignment.gradeName) {
            const gradeNum = assignment.gradeName.replace('학년', '').trim();
            return `${gradeNum}-${assignment.classId}`;
        }
        const grade = grades.find(g => g.id === assignment.gradeId);
        if (grade) {
            const gradeNum = grade.name.replace('학년', '').trim();
            return `${gradeNum}-${assignment.classId}`;
        }
        return `?-${assignment.classId}`;
    };

    // Find assignment for a specific cell (Coordinate-based lookup)
    const findAssignment = (day, period) => {
        if (filterRoom) {
            return assignments.filter(a =>
                a.moduleLocation === filterRoom &&
                a.day === day &&
                a.period === period
            );
        }
        const found = assignments.find(a =>
            a.gradeId === gradeId &&
            a.classId === classId &&
            a.day === day &&
            a.period === period
        );
        return found ? [found] : [];
    };

    // Check if cell has conflict
    const hasConflict = (day, period) => {
        return conflictCells.some(c =>
            c.gradeId === gradeId &&
            c.classId === classId &&
            c.day === day &&
            c.period === period
        );
    };

    // Check if period exceeds daily max
    const exceedsMax = (dayIndex, period) => {
        if (!dailyMaxHours) return false;
        return period > dailyMaxHours[dayIndex];
    };

    // Check for all conflict types when dragging (real-time conflict detection)
    const checkAllConflicts = (day, period, draggedAssignment) => {
        if (!draggedAssignment) return null;

        const conflicts = [];

        // 1. Room conflict (same room, same time, different class)
        const targetRoom = draggedAssignment.moduleLocation;
        if (targetRoom && targetRoom !== '교실') {
            const roomConflict = assignments.find(a =>
                a.id !== draggedAssignment.id &&
                a.moduleLocation === targetRoom &&
                a.day === day &&
                a.period === period
            );

            if (roomConflict) {
                conflicts.push({
                    type: CONFLICT_TYPES.ROOM_OVERLAP,
                    gradeClass: formatGradeClass(roomConflict),
                    room: targetRoom,
                    subject: roomConflict.subjectName,
                    message: `${formatGradeClass(roomConflict)}이(가) ${targetRoom} 사용 중`
                });
            }
        }

        // 2. Class conflict (same class already has assignment at this time)
        if (!filterRoom) {
            const classConflict = assignments.find(a =>
                a.id !== draggedAssignment.id &&
                a.gradeId === draggedAssignment.gradeId &&
                a.classId === draggedAssignment.classId &&
                a.day === day &&
                a.period === period
            );

            if (classConflict) {
                conflicts.push({
                    type: CONFLICT_TYPES.CLASS_OVERLAP,
                    subject: classConflict.subjectName,
                    message: `이미 ${classConflict.subjectName} 배정됨`
                });
            }
        }

        // 3. Teacher conflict (same teacher at same time)
        if (draggedAssignment.teacherId) {
            const teacherConflict = assignments.find(a =>
                a.id !== draggedAssignment.id &&
                a.teacherId === draggedAssignment.teacherId &&
                a.day === day &&
                a.period === period
            );

            if (teacherConflict) {
                conflicts.push({
                    type: CONFLICT_TYPES.TEACHER_OVERLAP,
                    gradeClass: formatGradeClass(teacherConflict),
                    teacher: draggedAssignment.teacherName,
                    message: `${draggedAssignment.teacherName || '교사'} 시간 중복`
                });
            }
        }

        // 4. Daily max exceeded
        if (dailyMaxHours) {
            const dayIndex = DAYS.indexOf(day);
            const maxPeriods = dailyMaxHours[dayIndex] || 6;
            if (period > maxPeriods) {
                conflicts.push({
                    type: CONFLICT_TYPES.DAILY_MAX_EXCEEDED,
                    message: `최대 ${maxPeriods}교시 초과`
                });
            }
        }

        return conflicts.length > 0 ? conflicts : null;
    };

    // Legacy function for backward compatibility
    const checkRoomConflict = (day, period, draggedAssignment) => {
        const conflicts = checkAllConflicts(day, period, draggedAssignment);
        if (conflicts && conflicts.length > 0) {
            const roomConflict = conflicts.find(c => c.type === CONFLICT_TYPES.ROOM_OVERLAP);
            if (roomConflict) {
                return roomConflict;
            }
            // Return first conflict if no room conflict
            return conflicts[0];
        }
        return null;
    };

    // Drag handlers
    const handleDragStart = (e, assignment) => {
        setDraggedItem(assignment);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', assignment.id);
    };

    const handleDragOver = (e, day, period) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTarget({ day, period });

        // Real-time conflict detection
        if (draggedItem) {
            const conflict = checkRoomConflict(day, period, draggedItem);
            setHoverConflict(conflict ? { day, period, ...conflict } : null);
        }
    };

    const handleDragLeave = () => {
        setDropTarget(null);
        setHoverConflict(null);
    };

    // Universal Drop Handler - Works in BOTH Grade View AND Room View
    const handleDrop = (e, targetDay, targetPeriod) => {
        e.preventDefault();
        setDropTarget(null);
        setHoverConflict(null);

        if (!draggedItem) return;

        // In Room View: Simply update day/period (room stays the same)
        // In Grade View: Check for swap with same class
        if (filterRoom) {
            // ROOM VIEW: Move assignment to new time slot
            // The assignment keeps its grade/class, just changes day/period
            setAssignments(prev => {
                return prev.map(a => {
                    if (a.id === draggedItem.id) {
                        return { ...a, day: targetDay, period: targetPeriod };
                    }
                    return a;
                });
            });
        } else {
            // GRADE VIEW: Check for swap within the same class
            const existingAtTarget = assignments.find(a =>
                a.gradeId === draggedItem.gradeId &&
                a.classId === draggedItem.classId &&
                a.day === targetDay &&
                a.period === targetPeriod
            );

            setAssignments(prev => {
                return prev.map(a => {
                    if (a.id === draggedItem.id) {
                        return { ...a, day: targetDay, period: targetPeriod };
                    }
                    if (existingAtTarget && a.id === existingAtTarget.id) {
                        return { ...a, day: draggedItem.day, period: draggedItem.period };
                    }
                    return a;
                });
            });
        }

        setDraggedItem(null);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDropTarget(null);
        setHoverConflict(null);
    };

    // Delete assignment
    const handleDelete = (e, assignmentId) => {
        e.stopPropagation();
        setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-sm">
                <thead>
                    <tr className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                        <th className="p-3 text-center font-semibold w-16">교시</th>
                        {DAYS.map((day) => (
                            <th key={day} className="p-3 text-center font-semibold min-w-32">
                                {day}요일
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {PERIODS.map(period => (
                        <tr key={period} className="border-b border-gray-100">
                            <td className={`p-2 text-center font-medium ${period <= 4 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-600'}`}>
                                {period}
                                {period <= 4 && <span className="text-[10px] block text-amber-500">오전</span>}
                            </td>
                            {DAYS.map((day, dayIndex) => {
                                const cellAssignments = findAssignment(day, period);
                                const isDropTarget = dropTarget?.day === day && dropTarget?.period === period;
                                const isConflict = hasConflict(day, period);
                                const isDisabled = exceedsMax(dayIndex, period);

                                // Real-time conflict overlay
                                const showConflictOverlay = hoverConflict &&
                                    hoverConflict.day === day &&
                                    hoverConflict.period === period;

                                return (
                                    <td
                                        key={`${day}-${period}`}
                                        className={`
                                            p-1 text-center relative min-h-16 h-16 transition-all
                                            ${isDropTarget ? 'border-4 border-red-500 border-dashed bg-red-50' : 'border border-gray-200'}
                                            ${isConflict ? 'bg-red-100' : ''}
                                            ${isDisabled ? 'bg-gray-100' : ''}
                                        `}
                                        onDragOver={(e) => !isDisabled && handleDragOver(e, day, period)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => !isDisabled && handleDrop(e, day, period)}
                                    >
                                        {/* Real-time Conflict Warning Overlay - Enhanced */}
                                        {showConflictOverlay && (
                                            <div className={`
                                                absolute inset-0 z-20 flex items-center justify-center p-1
                                                ${hoverConflict.type === CONFLICT_TYPES.ROOM_OVERLAP ? 'bg-red-500/85' : ''}
                                                ${hoverConflict.type === CONFLICT_TYPES.CLASS_OVERLAP ? 'bg-orange-500/85' : ''}
                                                ${hoverConflict.type === CONFLICT_TYPES.TEACHER_OVERLAP ? 'bg-purple-500/85' : ''}
                                                ${hoverConflict.type === CONFLICT_TYPES.DAILY_MAX_EXCEEDED ? 'bg-amber-500/85' : ''}
                                                ${!hoverConflict.type ? 'bg-red-500/85' : ''}
                                            `}>
                                                <span className="text-white text-xs font-bold text-center leading-tight flex items-center gap-0.5 justify-center">
                                                    <AlertTriangle className="w-3 h-3 inline-block shrink-0" />
                                                    {hoverConflict.message || (
                                                        hoverConflict.gradeClass
                                                            ? `${hoverConflict.gradeClass}이(가) ${hoverConflict.room}을 사용 중!`
                                                            : '충돌 발생'
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                        {cellAssignments.length > 0 ? (
                                            <div className={`
                                                flex flex-col gap-0.5 h-full
                                                ${cellAssignments.some(a => a.halfPeriodSlot) ? 'grid grid-rows-2' : ''}
                                            `}>
                                                {/* Render half-period cells in correct order */}
                                                {cellAssignments.some(a => a.halfPeriodSlot) ? (
                                                    <>
                                                        {/* First half */}
                                                        {cellAssignments.filter(a => a.halfPeriodSlot === 'first' || (!a.halfPeriodSlot && a.duration === 1)).map(assignment => (
                                                            <div
                                                                key={assignment.id}
                                                                draggable={true}
                                                                onDragStart={(e) => handleDragStart(e, assignment)}
                                                                onDragEnd={handleDragEnd}
                                                                className={`
                                                                    group px-1 py-0.5 rounded text-xs font-medium cursor-move relative
                                                                    transition-all hover:scale-105 hover:shadow-md
                                                                    ${getSubjectColorClass(assignment.moduleLocation)}
                                                                    ${draggedItem?.id === assignment.id ? 'opacity-50 scale-95' : ''}
                                                                    ${isConflict ? 'ring-2 ring-red-500' : 'border'}
                                                                    ${assignment.halfPeriodSlot ? 'border-dashed' : ''}
                                                                `}
                                                            >
                                                                <div className="font-semibold truncate flex items-center gap-0.5 text-[10px]">
                                                                    {assignment.halfPeriodSlot && <span className="text-[8px]">½</span>}
                                                                    {filterRoom ? formatGradeClass(assignment) : assignment.subjectName}
                                                                </div>
                                                                <button
                                                                    onClick={(e) => handleDelete(e, assignment.id)}
                                                                    className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white rounded-full text-[8px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                                    aria-label="배정 삭제"
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {/* Second half */}
                                                        {cellAssignments.filter(a => a.halfPeriodSlot === 'second').map(assignment => (
                                                            <div
                                                                key={assignment.id}
                                                                draggable={true}
                                                                onDragStart={(e) => handleDragStart(e, assignment)}
                                                                onDragEnd={handleDragEnd}
                                                                className={`
                                                                    group px-1 py-0.5 rounded text-xs font-medium cursor-move relative
                                                                    transition-all hover:scale-105 hover:shadow-md
                                                                    ${getSubjectColorClass(assignment.moduleLocation)}
                                                                    ${draggedItem?.id === assignment.id ? 'opacity-50 scale-95' : ''}
                                                                    ${isConflict ? 'ring-2 ring-red-500' : 'border'}
                                                                    border-dashed
                                                                `}
                                                            >
                                                                <div className="font-semibold truncate flex items-center gap-0.5 text-[10px]">
                                                                    <span className="text-[8px]">½</span>
                                                                    {filterRoom ? formatGradeClass(assignment) : assignment.subjectName}
                                                                </div>
                                                                <button
                                                                    onClick={(e) => handleDelete(e, assignment.id)}
                                                                    className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white rounded-full text-[8px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                                    aria-label="배정 삭제"
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </>
                                                ) : (
                                                    /* Normal full-period rendering */
                                                    cellAssignments.map(assignment => (
                                                        <div
                                                            key={assignment.id}
                                                            draggable={true}
                                                            onDragStart={(e) => handleDragStart(e, assignment)}
                                                            onDragEnd={handleDragEnd}
                                                            className={`
                                                                group px-2 py-1 rounded text-xs font-medium cursor-move relative
                                                                transition-all hover:scale-105 hover:shadow-md
                                                                ${getSubjectColorClass(assignment.moduleLocation)}
                                                                ${draggedItem?.id === assignment.id ? 'opacity-50 scale-95' : ''}
                                                                ${isConflict ? 'ring-2 ring-red-500' : 'border'}
                                                                ${assignment.isBlockPart ? 'border-l-4 border-l-indigo-500' : ''}
                                                            `}
                                                        >
                                                            <div className="font-semibold truncate flex items-center gap-0.5">
                                                                {assignment.moduleLocation === '교실' && (
                                                                    <School className="w-3 h-3 inline-block" title="교실 수업" />
                                                                )}
                                                                {filterRoom ? formatGradeClass(assignment) : assignment.subjectName}
                                                            </div>
                                                            <div className="text-[10px] opacity-75 truncate">
                                                                {filterRoom ? assignment.subjectName : assignment.moduleLocation}
                                                            </div>
                                                            <button
                                                                onClick={(e) => handleDelete(e, assignment.id)}
                                                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-sm hover:bg-red-600"
                                                                aria-label="배정 삭제"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        ) : isDisabled ? (
                                            <span className="text-gray-300 text-xs">-</span>
                                        ) : null}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Legend */}
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-amber-50 border border-amber-200 rounded"></span>
                    오전 (1-4교시)
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 border-l-4 border-l-indigo-500 bg-gray-100 rounded"></span>
                    블록 수업
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-red-100 border border-red-300 rounded"></span>
                    충돌
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-red-500/80 rounded"></span>
                    드래그 충돌 경고
                </span>
            </div>
        </div>
    );
}
