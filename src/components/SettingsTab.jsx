import React, { useState } from 'react';
import { Plus, Trash2, Settings, AlertTriangle, UserCheck, GripVertical } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const DAYS_KR = ['월', '화', '수', '목', '금'];

export default function SettingsTab({
    grades,
    setGrades,
    subjects,
    setSubjects,
    specialRooms,
    setSpecialRooms,
    setAssignments,
    teachers = [],
    setTeachers = () => {},
    addToast = () => {},
    showConfirm = () => {},
    closeConfirm = () => {}
}) {
    // Removed expandedGrade state - all grade cards are now always expanded
    const [newRoom, setNewRoom] = useState('');

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

        showConfirm(
            '학년 삭제',
            `"${grade.name}"을(를) 삭제하시겠습니까?\n\n이 학년의 모든 과목과 시간표 배정이 함께 삭제됩니다.`,
            () => {
                setGrades(prev => prev.filter(g => g.id !== gradeId));
                setSubjects(prev => prev.filter(s => s.gradeId !== gradeId));
                setAssignments(prev => prev.filter(a => a.gradeId !== gradeId));
                closeConfirm();
                addToast(`${grade.name}이(가) 삭제되었습니다.`, 'success');
            },
            true
        );
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

    // Helper to get room name (supports both string and object formats)
    const getRoomName = (room) => typeof room === 'string' ? room : room.name;
    const getRoomCapacity = (room) => typeof room === 'string' ? 1 : (room.capacity || 1);
    const getRoomId = (room) => typeof room === 'string' ? room : room.id;

    // Add special rooms - supports batch input with space separation
    const addSpecialRoom = () => {
        const input = newRoom.trim();
        if (!input) return;

        // Split by spaces and filter unique, non-empty tokens
        const existingNames = specialRooms.map(getRoomName);
        const newRooms = input.split(' ')
            .map(r => r.trim())
            .filter(r => r && !existingNames.includes(r))
            .map(name => ({ id: uuidv4(), name, capacity: 1 }));

        if (newRooms.length > 0) {
            setSpecialRooms(prev => [...prev, ...newRooms]);
            setNewRoom('');
        }
    };

    // Remove special room
    const removeSpecialRoom = (room) => {
        const roomId = getRoomId(room);
        setSpecialRooms(prev => prev.filter(r => getRoomId(r) !== roomId));
    };

    // Update room capacity
    const updateRoomCapacity = (room, capacity) => {
        const roomId = getRoomId(room);
        setSpecialRooms(prev => prev.map(r => {
            if (getRoomId(r) === roomId) {
                // Convert string to object if needed
                if (typeof r === 'string') {
                    return { id: roomId, name: r, capacity };
                }
                return { ...r, capacity };
            }
            return r;
        }));
    };

    // Add subject to grade
    const addSubject = (gradeId) => {
        const defaultRoomName = specialRooms[0] ? getRoomName(specialRooms[0]) : '';
        const newSubject = {
            id: uuidv4(),
            gradeId,
            name: '',
            modules: [{
                id: uuidv4(),
                location: defaultRoomName,
                locations: defaultRoomName ? [defaultRoomName] : [],
                weeklyHours: 2,
                blockCount: 2,
                hasBlock: false,
                allowClassroomFallback: false
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
        const defaultRoomName = specialRooms[0] ? getRoomName(specialRooms[0]) : '';
        setSubjects(prev => prev.map(s => {
            if (s.id === subjectId) {
                return {
                    ...s,
                    modules: [...s.modules, {
                        id: uuidv4(),
                        location: defaultRoomName,
                        locations: defaultRoomName ? [defaultRoomName] : [],
                        weeklyHours: 1,
                        blockCount: 2,
                        hasBlock: false,
                        allowClassroomFallback: false
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

    // Grade card drag handlers
    const handleGradeDragStart = (e, gradeId) => {
        e.dataTransfer.setData('type', 'grade');
        e.dataTransfer.setData('id', gradeId);
        e.dataTransfer.effectAllowed = 'move';
    };

    // Teacher management functions
    const addTeacher = () => {
        const newTeacher = {
            id: uuidv4(),
            name: '',
            gradeId: grades[0]?.id || null,
            subjectId: null,
            assignedClasses: []  // Which classes this teacher handles
        };
        setTeachers(prev => [...prev, newTeacher]);
    };

    const removeTeacher = (teacherId) => {
        setTeachers(prev => prev.filter(t => t.id !== teacherId));
        // Also clear teacher references from subjects
        setSubjects(prev => prev.map(s => ({
            ...s,
            modules: s.modules.map(m =>
                m.teacherId === teacherId ? { ...m, teacherId: null } : m
            )
        })));
    };

    const updateTeacher = (teacherId, field, value) => {
        setTeachers(prev => prev.map(t =>
            t.id === teacherId ? { ...t, [field]: value } : t
        ));
    };

    const toggleTeacherClass = (teacherId, classNum) => {
        setTeachers(prev => prev.map(t => {
            if (t.id === teacherId) {
                const classes = t.assignedClasses || [];
                if (classes.includes(classNum)) {
                    return { ...t, assignedClasses: classes.filter(c => c !== classNum) };
                } else {
                    return { ...t, assignedClasses: [...classes, classNum].sort((a, b) => a - b) };
                }
            }
            return t;
        }));
    };

    return (
        <div className="space-y-6 relative">
            {/* Special Rooms Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-teal-500" />
                    특별실 관리
                    <span className="text-xs font-normal text-gray-400 ml-1">정원 = 동시에 사용 가능한 학급 수</span>
                </h3>

                <div className="flex flex-wrap gap-2 mb-4">
                    {specialRooms.map(room => (
                        <div
                            key={getRoomId(room)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium"
                        >
                            <span>{getRoomName(room)}</span>
                            <div className="flex items-center gap-1 border-l border-teal-200 pl-2">
                                <span className="text-xs text-teal-500">정원</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="5"
                                    value={getRoomCapacity(room)}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        updateRoomCapacity(room, isNaN(val) ? 1 : Math.max(1, Math.min(5, val)));
                                    }}
                                    className="w-10 px-1 py-0.5 text-center border border-teal-200 rounded text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                                />
                            </div>
                            <button
                                onClick={() => removeSpecialRoom(room)}
                                className="text-teal-400 hover:text-red-500 transition-colors"
                                aria-label={`${getRoomName(room)} 삭제`}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newRoom}
                        onChange={(e) => setNewRoom(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addSpecialRoom()}
                        placeholder="특별실 이름 (공백으로 구분하여 여러 개 입력 가능)"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                    />
                    <button
                        onClick={addSpecialRoom}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors flex items-center gap-1"
                    >
                        <Plus className="w-4 h-4" />
                        추가
                    </button>
                </div>
            </div>

            {/* Teacher Management Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-purple-500" />
                        전담교사 관리
                    </h3>
                    <button
                        onClick={addTeacher}
                        className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-1"
                    >
                        <Plus className="w-4 h-4" />
                        교사 추가
                    </button>
                </div>

                {teachers.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">
                        등록된 교사가 없습니다. 교사를 추가하면 시간표 충돌을 방지할 수 있습니다.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {teachers.map(teacher => {
                            const teacherGrade = grades.find(g => g.id === teacher.gradeId);
                            return (
                                <div key={teacher.id} className="flex flex-wrap items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                    {/* Teacher Name */}
                                    <input
                                        type="text"
                                        value={teacher.name}
                                        onChange={(e) => updateTeacher(teacher.id, 'name', e.target.value)}
                                        placeholder="교사 이름"
                                        className="px-3 py-1.5 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm w-24"
                                    />

                                    {/* Grade Selection */}
                                    <select
                                        value={teacher.gradeId || ''}
                                        onChange={(e) => {
                                            updateTeacher(teacher.id, 'gradeId', e.target.value);
                                            updateTeacher(teacher.id, 'subjectId', null);
                                            updateTeacher(teacher.id, 'assignedClasses', []);
                                        }}
                                        className="px-2 py-1.5 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                    >
                                        <option value="">학년 선택</option>
                                        {grades.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>

                                    {/* Subject Selection (filtered by grade) */}
                                    <select
                                        value={teacher.subjectId || ''}
                                        onChange={(e) => updateTeacher(teacher.id, 'subjectId', e.target.value)}
                                        className="px-2 py-1.5 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                        disabled={!teacher.gradeId}
                                    >
                                        <option value="">과목 선택</option>
                                        {subjects.filter(s => s.gradeId === teacher.gradeId && s.name).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>

                                    {/* Assigned Classes */}
                                    {teacher.gradeId && teacherGrade && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-purple-600">담당:</span>
                                            {Array.from({ length: teacherGrade.classCount }, (_, i) => i + 1).map(classNum => (
                                                <button
                                                    key={classNum}
                                                    onClick={() => toggleTeacherClass(teacher.id, classNum)}
                                                    className={`
                                                        w-6 h-6 text-xs rounded-full font-medium transition-all
                                                        ${(teacher.assignedClasses || []).includes(classNum)
                                                            ? 'bg-purple-500 text-white'
                                                            : 'bg-white border border-purple-300 text-purple-600 hover:bg-purple-100'
                                                        }
                                                    `}
                                                >
                                                    {classNum}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Delete Button */}
                                    <button
                                        onClick={() => removeTeacher(teacher.id)}
                                        className="p-1.5 text-purple-400 hover:text-red-500 transition-colors ml-auto"
                                        aria-label="교사 삭제"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Grade Management Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">학년 관리</h3>
                <button
                    onClick={addGrade}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all shadow-sm flex items-center gap-2 font-medium"
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
                        <div className={`p-4 text-white grade-header-${grades.indexOf(grade) % 6 + 1}`}>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 flex-1">
                                    <GripVertical className="w-4 h-4 text-white/60 shrink-0" />
                                    <div>
                                        <h3 className="text-lg font-bold">{grade.name}</h3>
                                        <p className="text-white/80 text-sm mt-1">
                                            {grade.classCount}학급 · 과목 {subjects.filter(s => s.gradeId === grade.id).length}개
                                        </p>
                                    </div>
                                </div>

                                {/* DELETE GRADE BUTTON */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteGrade(grade.id);
                                    }}
                                    className="p-2 rounded-lg bg-white/20 hover:bg-red-500 transition-colors group"
                                    title="학년 삭제"
                                    aria-label={`${grade.name} 삭제`}
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
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
                                                className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
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
                                    className="px-3 py-1 text-sm bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors flex items-center gap-1"
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
                                                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
                                            />
                                            <button
                                                onClick={() => removeSubject(subject.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                                aria-label="과목 삭제"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Modules */}
                                        <div className="space-y-2">
                                            {subject.modules.map((module) => (
                                                <div key={module.id} className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                                                    {/* Multiple location selector */}
                                                    <div className="relative group">
                                                        <button
                                                            type="button"
                                                            className="px-2 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none min-w-24 text-left flex items-center gap-1"
                                                        >
                                                            <span className="truncate">
                                                                {(module.locations && module.locations.length > 0)
                                                                    ? (module.locations.length === 1
                                                                        ? module.locations[0]
                                                                        : `${module.locations[0]} 외 ${module.locations.length - 1}`)
                                                                    : (module.location || '선택')}
                                                            </span>
                                                            <span className="text-gray-400">▼</span>
                                                        </button>
                                                        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-40 hidden group-hover:block">
                                                            <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                                                                {specialRooms.map(room => {
                                                                    const roomName = getRoomName(room);
                                                                    const roomCapacity = getRoomCapacity(room);
                                                                    const currentLocations = module.locations || (module.location ? [module.location] : []);
                                                                    const isSelected = currentLocations.includes(roomName);
                                                                    return (
                                                                        <label
                                                                            key={getRoomId(room)}
                                                                            className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isSelected}
                                                                                onChange={(e) => {
                                                                                    let newLocations;
                                                                                    if (e.target.checked) {
                                                                                        newLocations = [...currentLocations, roomName];
                                                                                    } else {
                                                                                        newLocations = currentLocations.filter(l => l !== roomName);
                                                                                    }
                                                                                    // Ensure at least one location
                                                                                    if (newLocations.length === 0) {
                                                                                        newLocations = [roomName];
                                                                                    }
                                                                                    updateModule(subject.id, module.id, 'locations', newLocations);
                                                                                    // Also update legacy location field
                                                                                    updateModule(subject.id, module.id, 'location', newLocations[0]);
                                                                                }}
                                                                                className="w-4 h-4 text-teal-500 rounded focus:ring-teal-500"
                                                                            />
                                                                            <span className={isSelected ? 'font-medium text-teal-700' : 'text-gray-700'}>
                                                                                {roomName}
                                                                                {roomCapacity > 1 && (
                                                                                    <span className="ml-1 text-xs text-gray-400">({roomCapacity}학급)</span>
                                                                                )}
                                                                            </span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Weekly Hours - Supports 0.5 increments */}
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            min="0.5"
                                                            max="10"
                                                            step="0.5"
                                                            value={module.weeklyHours}
                                                            onChange={(e) => {
                                                                const parsed = parseFloat(e.target.value);
                                                                const val = isNaN(parsed) ? 1 : Math.max(0.5, Math.min(10, Math.round(parsed * 2) / 2));
                                                                updateModule(subject.id, module.id, 'weeklyHours', val);
                                                            }}
                                                            className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-center"
                                                        />
                                                        <span className="text-gray-500">시수</span>
                                                    </div>

                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={module.hasBlock}
                                                            onChange={(e) => updateModule(subject.id, module.id, 'hasBlock', e.target.checked)}
                                                            className="w-4 h-4 text-teal-500 rounded focus:ring-teal-500"
                                                        />
                                                        <span className="text-gray-600">블록</span>
                                                    </label>

                                                    <label className="flex items-center gap-1 cursor-pointer" title="특별실 부족 시 교실에서 수업 가능">
                                                        <input
                                                            type="checkbox"
                                                            checked={module.allowClassroomFallback || false}
                                                            onChange={(e) => updateModule(subject.id, module.id, 'allowClassroomFallback', e.target.checked)}
                                                            className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                                                        />
                                                        <span className="text-amber-700">교실허용</span>
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
                                                                className="w-12 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-center"
                                                            />
                                                            <span className="text-gray-500">연속</span>
                                                        </div>
                                                    )}

                                                    {subject.modules.length > 1 && (
                                                        <button
                                                            onClick={() => removeModule(subject.id, module.id)}
                                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors ml-auto"
                                                            aria-label="모듈 삭제"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => addModule(subject.id)}
                                            className="mt-2 text-sm text-teal-500 hover:text-teal-600 flex items-center gap-1"
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
                    <div className="col-span-full text-center py-12 bg-white rounded-xl border-2 border-dashed border-stone-300">
                        <Settings className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                        <p className="text-stone-600 font-medium mb-2">시작하기</p>
                        <p className="text-stone-400 text-sm mb-6 max-w-xs mx-auto">
                            학년을 추가하고 과목을 설정하면<br />자동으로 시간표를 편성할 수 있습니다.
                        </p>
                        <button
                            onClick={addGrade}
                            className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
                        >
                            첫 학년 추가하기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
