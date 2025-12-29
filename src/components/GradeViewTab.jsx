import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, CheckCircle, AlertTriangle, Trash2, Sun } from 'lucide-react';
import TimetableGrid from './TimetableGrid';
import { runAutoScheduler, validateAssignments } from '../utils/scheduler';

export default function GradeViewTab({
    grades,
    subjects,
    assignments,
    setAssignments
}) {
    // Use first available grade as default
    const [selectedGradeId, setSelectedGradeId] = useState(grades[0]?.id || null);
    const [selectedClass, setSelectedClass] = useState(1);
    const [showResult, setShowResult] = useState(null);
    const [conflicts, setConflicts] = useState([]);
    const [morningPriority, setMorningPriority] = useState(true);
    const [dragOverTrash, setDragOverTrash] = useState(false);

    // Update selected grade if current one is deleted
    useEffect(() => {
        if (grades.length > 0 && !grades.find(g => g.id === selectedGradeId)) {
            setSelectedGradeId(grades[0].id);
            setSelectedClass(1);
        }
    }, [grades, selectedGradeId]);

    const currentGrade = grades.find(g => g.id === selectedGradeId);
    const currentGradeIndex = grades.findIndex(g => g.id === selectedGradeId);
    const maxClass = currentGrade?.classCount || 1;

    // Navigate classes
    const prevClass = () => {
        if (selectedClass > 1) {
            setSelectedClass(selectedClass - 1);
        } else if (currentGradeIndex > 0) {
            const prevGrade = grades[currentGradeIndex - 1];
            if (prevGrade && prevGrade.classCount > 0) {
                setSelectedGradeId(prevGrade.id);
                setSelectedClass(prevGrade.classCount);
            }
        }
    };

    const nextClass = () => {
        if (selectedClass < maxClass) {
            setSelectedClass(selectedClass + 1);
        } else if (currentGradeIndex < grades.length - 1) {
            const nextGrade = grades[currentGradeIndex + 1];
            if (nextGrade && nextGrade.classCount > 0) {
                setSelectedGradeId(nextGrade.id);
                setSelectedClass(1);
            }
        }
    };

    // Run auto scheduler for single grade
    const handleAutoSchedule = () => {
        if (!currentGrade) {
            alert('선택된 학년이 없습니다.');
            return;
        }

        const gradeSubjects = subjects.filter(s => s.gradeId === selectedGradeId && s.name.trim());

        if (gradeSubjects.length === 0) {
            alert('배정할 과목이 없습니다. 기본 설정에서 과목을 추가해주세요.');
            return;
        }

        // Clear existing assignments for this grade
        const otherAssignments = assignments.filter(a => a.gradeId !== selectedGradeId);

        const result = runAutoScheduler(gradeSubjects, grades, otherAssignments, morningPriority);
        setAssignments(result.assignments);
        setShowResult(result);
        setConflicts([]);

        setTimeout(() => setShowResult(null), 5000);
    };

    // Run all grades scheduler
    const handleAutoScheduleAll = () => {
        const allSubjects = subjects.filter(s => s.name.trim());

        if (allSubjects.length === 0) {
            alert('배정할 과목이 없습니다. 기본 설정에서 과목을 추가해주세요.');
            return;
        }

        const result = runAutoScheduler(allSubjects, grades, [], morningPriority);
        setAssignments(result.assignments);
        setShowResult(result);
        setConflicts([]);

        setTimeout(() => setShowResult(null), 5000);
    };

    // Validate current timetable
    const handleValidate = () => {
        const foundConflicts = validateAssignments(assignments);
        setConflicts(foundConflicts);

        if (foundConflicts.length === 0) {
            alert('✅ 시간표에 충돌이 없습니다!');
        }
    };

    // Trash bin handlers
    const handleTrashDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverTrash(true);
    };

    const handleTrashDragLeave = () => {
        setDragOverTrash(false);
    };

    const handleTrashDrop = (e) => {
        e.preventDefault();
        setDragOverTrash(false);
        const assignmentId = e.dataTransfer.getData('text/plain');
        if (assignmentId) {
            setAssignments(prev => prev.filter(a => a.id !== assignmentId));
        }
    };

    // Clear all assignments for current grade
    const handleClearGrade = () => {
        if (!currentGrade) return;
        if (confirm(`${currentGrade.name} 시간표를 모두 삭제하시겠습니까?`)) {
            setAssignments(prev => prev.filter(a => a.gradeId !== selectedGradeId));
        }
    };

    // Convert conflicts to cell markers
    const conflictCells = conflicts.flatMap(c =>
        c.assignments.map(a => ({
            gradeId: a.gradeId,
            classId: a.classId,
            day: a.day,
            period: a.period
        }))
    );

    // Show empty state if no grades
    if (grades.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">등록된 학년이 없습니다</h3>
                <p className="text-gray-500">기본 설정 탭에서 학년을 추가해주세요.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Grade/Class Navigation */}
                    <div className="flex items-center gap-4">
                        {/* Grade Selector - Dynamic */}
                        <div className="flex gap-1 flex-wrap">
                            {grades.map(grade => (
                                <button
                                    key={grade.id}
                                    onClick={() => {
                                        setSelectedGradeId(grade.id);
                                        setSelectedClass(1);
                                    }}
                                    disabled={grade.classCount === 0}
                                    className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${selectedGradeId === grade.id
                                            ? 'bg-indigo-500 text-white shadow-md'
                                            : grade.classCount > 0
                                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                        }
                  `}
                                >
                                    {grade.name}
                                </button>
                            ))}
                        </div>

                        {/* Class Navigation */}
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={prevClass}
                                className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <span className="px-3 font-semibold text-gray-700 min-w-16 text-center">
                                {selectedClass}반
                            </span>
                            <button
                                onClick={nextClass}
                                className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                    </div>

                    {/* Action Buttons & Trash Bin */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Morning Priority Toggle */}
                        <label className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors">
                            <input
                                type="checkbox"
                                checked={morningPriority}
                                onChange={(e) => setMorningPriority(e.target.checked)}
                                className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                            />
                            <Sun className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-800">오전 수업 우선</span>
                        </label>

                        {/* Auto Schedule Buttons */}
                        <button
                            onClick={handleAutoSchedule}
                            disabled={!currentGrade}
                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-sm flex items-center gap-2 font-medium disabled:opacity-50"
                        >
                            <Play className="w-4 h-4" />
                            {currentGrade?.name || '학년'} 자동 배정
                        </button>
                        <button
                            onClick={handleAutoScheduleAll}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all shadow-sm flex items-center gap-2 font-medium"
                        >
                            <Play className="w-4 h-4" />
                            전체 자동 배정
                        </button>
                        <button
                            onClick={handleValidate}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all flex items-center gap-2 font-medium"
                        >
                            <CheckCircle className="w-4 h-4" />
                            시간표 점검
                        </button>

                        {/* Trash Bin */}
                        <div
                            onDragOver={handleTrashDragOver}
                            onDragLeave={handleTrashDragLeave}
                            onDrop={handleTrashDrop}
                            onClick={handleClearGrade}
                            className={`
                p-3 rounded-lg border-2 border-dashed cursor-pointer transition-all
                ${dragOverTrash
                                    ? 'bg-red-100 border-red-500 scale-110'
                                    : 'bg-gray-50 border-gray-300 hover:border-red-300 hover:bg-red-50'}
              `}
                            title="드래그하여 삭제 / 클릭하여 학년 전체 삭제"
                        >
                            <Trash2 className={`w-5 h-5 ${dragOverTrash ? 'text-red-500' : 'text-gray-400'}`} />
                        </div>
                    </div>
                </div>

                {/* Result Banner - with detailed failure report */}
                {showResult && (
                    <div className={`
                        mt-4 p-3 rounded-lg text-sm font-medium
                        ${showResult.failureCount === 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }
                    `}>
                        <div className="flex items-center gap-2">
                            {showResult.failureCount === 0 ? (
                                <CheckCircle className="w-5 h-5" />
                            ) : (
                                <AlertTriangle className="w-5 h-5" />
                            )}
                            <span>
                                자동 배정 완료: 총 {showResult.totalUnits}개 중 {showResult.successCount}개 성공
                                {showResult.failureCount > 0 && `, ${showResult.failureCount}개 실패`}
                                {morningPriority && <span className="ml-2 text-amber-600">(오전 우선)</span>}
                            </span>
                        </div>

                        {/* Detailed failure list - FIX for vague failure report */}
                        {showResult.failedUnits && showResult.failedUnits.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-yellow-300">
                                <p className="text-xs font-semibold mb-1">❌ 배정 실패 상세:</p>
                                <ul className="text-xs space-y-0.5 max-h-24 overflow-y-auto">
                                    {showResult.failedUnits.map((failed, idx) => {
                                        // Format: "6-1 과학" using gradeName
                                        const gradeNum = failed.gradeName ? failed.gradeName.replace('학년', '').trim() : '?';
                                        return (
                                            <li key={idx}>
                                                • {gradeNum}-{failed.classId} {failed.subjectName}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Conflict List */}
                {conflicts.length > 0 && (
                    <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                        <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            발견된 충돌 ({conflicts.length}건)
                        </h4>
                        <ul className="space-y-1 text-sm text-red-700 max-h-40 overflow-y-auto">
                            {conflicts.map((conflict, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                    <span className="font-medium shrink-0">[{conflict.type}]</span>
                                    <span>{conflict.message}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Timetable Grid */}
            {currentGrade && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        {currentGrade.name} {selectedClass}반 시간표
                    </h3>
                    <TimetableGrid
                        assignments={assignments}
                        setAssignments={setAssignments}
                        gradeId={selectedGradeId}
                        classId={selectedClass}
                        dailyMaxHours={currentGrade.dailyMaxHours}
                        conflictCells={conflictCells}
                    />
                </div>
            )}
        </div>
    );
}
