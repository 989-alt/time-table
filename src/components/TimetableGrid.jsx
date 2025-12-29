import React, { useState } from 'react';
import { DAYS, PERIODS, getSubjectColorClass } from '../utils/scheduler';

export default function TimetableGrid({
    assignments,
    setAssignments,
    gradeId,
    classId,
    dailyMaxHours,
    conflictCells = [],
    showAllGrades = false,
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

    // Check for room conflict when dragging (real-time conflict detection)
    const checkRoomConflict = (day, period, draggedAssignment) => {
        if (!draggedAssignment) return null;

        // Find any assignments in this slot that would conflict
        // In Room View: Check if another class is using the same room at this time
        // In Grade View: Check if another class is using the dragged item's room at this time

        const targetRoom = draggedAssignment.moduleLocation;

        const conflictingAssignment = assignments.find(a =>
            a.id !== draggedAssignment.id &&
            a.moduleLocation === targetRoom &&
            a.day === day &&
            a.period === period
        );

        if (conflictingAssignment) {
            return {
                gradeClass: formatGradeClass(conflictingAssignment),
                room: targetRoom,
                subject: conflictingAssignment.subjectName
            };
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
                                        {/* Real-time Conflict Warning Overlay */}
                                        {showConflictOverlay && (
                                            <div className="absolute inset-0 bg-red-500/80 z-20 flex items-center justify-center p-1">
                                                <span className="text-white text-xs font-bold text-center leading-tight">
                                                    ⚠️ {hoverConflict.gradeClass}이(가)<br />
                                                    {hoverConflict.room}을 사용 중!
                                                </span>
                                            </div>
                                        )}

                                        {cellAssignments.length > 0 ? (
                                            <div className="flex flex-col gap-0.5">
                                                {cellAssignments.map(assignment => (
                                                    <div
                                                        key={assignment.id}
                                                        draggable={true} // ENABLED for both views
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
                                                        <div className="font-semibold truncate">
                                                            {filterRoom ? formatGradeClass(assignment) : assignment.subjectName}
                                                        </div>
                                                        <div className="text-[10px] opacity-75 truncate">
                                                            {filterRoom ? assignment.subjectName : assignment.moduleLocation}
                                                        </div>
                                                        {/* Delete button - visible on both views */}
                                                        <button
                                                            onClick={(e) => handleDelete(e, assignment.id)}
                                                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-sm hover:bg-red-600"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
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
