import React, { useState } from 'react';
import { Plus, Trash2, Settings, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const DAYS_KR = ['월', '화', '수', '목', '금'];

export default function SettingsTab({
    grades,
    setGrades,
    subjects,
    setSubjects,
    specialRooms,
    setSpecialRooms,
    assignments,
    setAssignments
}) {
    // Removed expandedGrade state - all grade cards are now always expanded
    const [newRoom, setNewRoom] = useState('');
    const [dragOverTrash, setDragOverTrash] = useState(false);

    // Update grade class count - FIX: Proper parseInt to avoid '03' issue
    const updateClassCount = (gradeId, value) => {
        const parsed = parseInt(value, 10);
        const count = isNaN(parsed) ? 0 : Math.max(0, Math.min(15, parsed));
        setGrades(prev => prev.map(g =>
            g.id === gradeId ? { ...g, classCount: count } : g
        ));
    };

    // Update grade name
    const updateGradeName = (gradeId, name) => {
        setGrades(prev => prev.map(g =>
            g.id === gradeId ? { ...g, name } : g
        ));
    };

    // Update daily max hours - FIX: Proper parseInt
    const updateDailyMaxHours = (gradeId, dayIndex, value) => {
        const parsed = parseInt(value, 10);
        const hours = isNaN(parsed) ? 1 : Math.max(1, Math.min(6, parsed));
        setGrades(prev => prev.map(g => {
            if (g.id === gradeId) {
                const newHours = [...g.dailyMaxHours];
                newHours[dayIndex] = hours;
                return { ...g, dailyMaxHours: newHours };
            }
            return g;
        }));
    };

    // DELETE GRADE - Critical Feature
    const deleteGrade = (gradeId) => {
        const grade = grades.find(g => g.id === gradeId);
        if (!grade) return;

        const confirmMsg = `"${grade.name}"을(를) 삭제하시겠습니까?\n\n⚠️ 이 학년의 모든 과목과 시간표 배정이 함께 삭제됩니다.`;
        if (!confirm(confirmMsg)) return;

        // Remove grade
        setGrades(prev => prev.filter(g => g.id !== gradeId));

        // Remove associated subjects
        setSubjects(prev => prev.filter(s => s.gradeId !== gradeId));

        // Remove associated assignments
        setAssignments(prev => prev.filter(a => a.gradeId !== gradeId));

        // Grade cards are now always expanded - no state to clear
    };

    // Add new grade
    const addGrade = () => {
        const existingNumbers = grades.map(g => {
            const match = g.name.match(/(\d+)/);
            return match ? parseInt(match[1]) : 0;
        });
        const nextNumber = Math.max(0, ...existingNumbers) + 1;

        const newGrade = {
            id: uuidv4(),
            name: `${nextNumber}학년`,
            classCount: 3,
            dailyMaxHours: [6, 6, 6, 6, 6]
        };
        setGrades(prev => [...prev, newGrade]);
    };

    // Add special rooms - supports batch input with space separation
    const addSpecialRoom = () => {
        const input = newRoom.trim();
        if (!input) return;

        // Split by spaces and filter unique, non-empty tokens
        const newRooms = input.split(' ')
            .map(r => r.trim())
            .filter(r => r && !specialRooms.includes(r));

        if (newRooms.length > 0) {
            setSpecialRooms(prev => [...prev, ...newRooms]);
            setNewRoom('');
        }
    };

    // Remove special room
    const removeSpecialRoom = (room) => {
        setSpecialRooms(prev => prev.filter(r => r !== room));
    };

    // Add subject to grade
    const addSubject = (gradeId) => {
        const newSubject = {
            id: uuidv4(),
            gradeId,
            name: '',
            modules: [{
                id: uuidv4(),
                location: specialRooms[0] || '',
                weeklyHours: 2,
                blockCount: 2,
                hasBlock: false
            }]
        };
        setSubjects(prev => [...prev, newSubject]);
    };

    // Remove subject
    const removeSubject = (subjectId) => {
        setSubjects(prev => prev.filter(s => s.id !== subjectId));
    };

    // Update subject name
    const updateSubjectName = (subjectId, name) => {
        setSubjects(prev => prev.map(s =>
            s.id === subjectId ? { ...s, name } : s
        ));
    };

    // Add module to subject
    const addModule = (subjectId) => {
        setSubjects(prev => prev.map(s => {
            if (s.id === subjectId) {
                return {
                    ...s,
                    modules: [...s.modules, {
                        id: uuidv4(),
                        location: specialRooms[0] || '',
                        weeklyHours: 1,
                        blockCount: 2,
                        hasBlock: false
                    }]
                };
            }
            return s;
        }));
    };

    // Remove module
    const removeModule = (subjectId, moduleId) => {
        setSubjects(prev => prev.map(s => {
            if (s.id === subjectId) {
                return {
                    ...s,
                    modules: s.modules.filter(m => m.id !== moduleId)
                };
            }
            return s;
        }));
    };

    // Update module
    const updateModule = (subjectId, moduleId, field, value) => {
        setSubjects(prev => prev.map(s => {
            if (s.id === subjectId) {
                return {
                    ...s,
                    modules: s.modules.map(m =>
                        m.id === moduleId ? { ...m, [field]: value } : m
                    )
                };
            }
            return s;
        }));
    };

    // Drag handlers for global trash bin
    const handleTrashDragOver = (e) => {
        e.preventDefault();
        setDragOverTrash(true);
    };

    const handleTrashDragLeave = () => {
        setDragOverTrash(false);
    };

    const handleTrashDrop = (e) => {
        e.preventDefault();
        setDragOverTrash(false);

        const dataType = e.dataTransfer.getData('type');
        const dataId = e.dataTransfer.getData('id');

        if (dataType === 'grade') {
            deleteGrade(dataId);
        } else if (dataType === 'subject') {
            removeSubject(dataId);
        }
    };

    // Grade card drag handlers
    const handleGradeDragStart = (e, gradeId) => {
        e.dataTransfer.setData('type', 'grade');
        e.dataTransfer.setData('id', gradeId);
        e.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="space-y-6 relative">
            {/* Special Rooms Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-500" />
                    특별실 관리
                </h3>

                <div className="flex flex-wrap gap-2 mb-4">
                    {specialRooms.map(room => (
                        <span
                            key={room}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium"
                        >
                            {room}
                            <button
                                onClick={() => removeSpecialRoom(room)}
                                className="ml-1 text-indigo-400 hover:text-red-500 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </span>
                    ))}
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newRoom}
                        onChange={(e) => setNewRoom(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addSpecialRoom()}
                        placeholder="특별실 이름 (공백으로 구분하여 여러 개 입력 가능)"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                    <button
                        onClick={addSpecialRoom}
                        className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors flex items-center gap-1"
                    >
                        <Plus className="w-4 h-4" />
                        추가
                    </button>
                </div>
            </div>

            {/* Grade Management Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">학년 관리</h3>
                <button
                    onClick={addGrade}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all shadow-sm flex items-center gap-2 font-medium"
                >
                    <Plus className="w-4 h-4" />
                    학년 추가
                </button>
            </div>

            {/* Grade Configuration Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {grades.map(grade => (
                    <div
                        key={grade.id}
                        draggable
                        onDragStart={(e) => handleGradeDragStart(e, grade.id)}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden card-hover cursor-move"
                    >
                        {/* Grade Header - Always Expanded */}
                        <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                            <div className="flex justify-between items-center">
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold">{grade.name}</h3>
                                    <p className="text-indigo-100 text-sm mt-1">
                                        {grade.classCount}학급 · 과목 {subjects.filter(s => s.gradeId === grade.id).length}개
                                    </p>
                                </div>

                                {/* DELETE GRADE BUTTON */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteGrade(grade.id);
                                    }}
                                    className="p-2 rounded-lg bg-white/20 hover:bg-red-500 transition-colors group"
                                    title="학년 삭제"
                                >
                                    <Trash2 className="w-4 h-4 text-white group-hover:text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Grade Body */}
                        <div className="p-4">
                            {/* Grade Name */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">학년 이름</label>
                                <input
                                    type="text"
                                    value={grade.name}
                                    onChange={(e) => updateGradeName(grade.id, e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                            </div>

                            {/* Class Count - FIX: Use string value to avoid leading zero issue */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">학급 수</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="15"
                                    value={grade.classCount.toString()}
                                    onChange={(e) => updateClassCount(grade.id, e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                            </div>

                            {/* Daily Max Hours */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">요일별 최대 교시</label>
                                <div className="grid grid-cols-5 gap-1">
                                    {DAYS_KR.map((day, idx) => (
                                        <div key={day} className="text-center">
                                            <div className="text-xs text-gray-500 mb-1">{day}</div>
                                            <input
                                                type="number"
                                                min="1"
                                                max="6"
                                                value={grade.dailyMaxHours[idx].toString()}
                                                onChange={(e) => updateDailyMaxHours(grade.id, idx, e.target.value)}
                                                className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Subjects Section - Always Visible */}
                        <div className="border-t border-gray-200 p-4 bg-gray-50">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-medium text-gray-700">전담 과목</h4>
                                <button
                                    onClick={() => addSubject(grade.id)}
                                    className="px-3 py-1 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors flex items-center gap-1"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    과목 추가
                                </button>
                            </div>

                            <div className="space-y-4">
                                {subjects.filter(s => s.gradeId === grade.id).map(subject => (
                                    <div key={subject.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                        {/* Subject Name - Korean input enforced */}
                                        <div className="flex gap-2 mb-3">
                                            <input
                                                type="search"
                                                autoComplete="off"
                                                lang="ko"
                                                value={subject.name}
                                                onChange={(e) => updateSubjectName(subject.id, e.target.value)}
                                                placeholder="과목명 (한글)"
                                                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                                            />
                                            <button
                                                onClick={() => removeSubject(subject.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Modules */}
                                        <div className="space-y-2">
                                            {subject.modules.map((module, moduleIdx) => (
                                                <div key={module.id} className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                                                    <select
                                                        value={module.location}
                                                        onChange={(e) => updateModule(subject.id, module.id, 'location', e.target.value)}
                                                        className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                                    >
                                                        {specialRooms.map(room => (
                                                            <option key={room} value={room}>{room}</option>
                                                        ))}
                                                    </select>

                                                    {/* Weekly Hours - FIX: Proper parseInt */}
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="10"
                                                            value={module.weeklyHours.toString()}
                                                            onChange={(e) => {
                                                                const parsed = parseInt(e.target.value, 10);
                                                                const val = isNaN(parsed) ? 1 : Math.max(1, Math.min(10, parsed));
                                                                updateModule(subject.id, module.id, 'weeklyHours', val);
                                                            }}
                                                            className="w-14 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-center"
                                                        />
                                                        <span className="text-gray-500">시수</span>
                                                    </div>

                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={module.hasBlock}
                                                            onChange={(e) => updateModule(subject.id, module.id, 'hasBlock', e.target.checked)}
                                                            className="w-4 h-4 text-indigo-500 rounded focus:ring-indigo-500"
                                                        />
                                                        <span className="text-gray-600">블록</span>
                                                    </label>

                                                    {module.hasBlock && (
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="number"
                                                                min="2"
                                                                max="3"
                                                                value={module.blockCount.toString()}
                                                                onChange={(e) => {
                                                                    const parsed = parseInt(e.target.value, 10);
                                                                    const val = isNaN(parsed) ? 2 : Math.max(2, Math.min(3, parsed));
                                                                    updateModule(subject.id, module.id, 'blockCount', val);
                                                                }}
                                                                className="w-12 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-center"
                                                            />
                                                            <span className="text-gray-500">연속</span>
                                                        </div>
                                                    )}

                                                    {subject.modules.length > 1 && (
                                                        <button
                                                            onClick={() => removeModule(subject.id, module.id)}
                                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors ml-auto"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => addModule(subject.id)}
                                            className="mt-2 text-sm text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            모듈 추가
                                        </button>
                                    </div>
                                ))}

                                {subjects.filter(s => s.gradeId === grade.id).length === 0 && (
                                    <p className="text-sm text-gray-400 text-center py-4">
                                        아직 등록된 과목이 없습니다
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Empty State */}
                {grades.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
                        <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 mb-4">등록된 학년이 없습니다</p>
                        <button
                            onClick={addGrade}
                            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                        >
                            첫 학년 추가하기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
