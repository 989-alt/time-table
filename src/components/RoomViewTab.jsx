import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import TimetableGrid from './TimetableGrid';

export default function RoomViewTab({
    specialRooms,
    assignments,
    setAssignments,
    grades = [] // Accept grades for formatting
}) {
    const [selectedRoom, setSelectedRoom] = useState(specialRooms[0] || '');

    // Count assignments per room
    const getRoomCount = (room) => {
        return assignments.filter(a => a.moduleLocation === room).length;
    };

    return (
        <div className="space-y-4">
            {/* Room Selector */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-500" />
                    특별실 선택
                </h3>

                <div className="flex flex-wrap gap-2">
                    {specialRooms.map(room => (
                        <button
                            key={room}
                            onClick={() => setSelectedRoom(room)}
                            className={`
                                px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2
                                ${selectedRoom === room
                                    ? 'bg-indigo-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }
                            `}
                        >
                            {room}
                            <span className={`
                                px-2 py-0.5 rounded-full text-xs
                                ${selectedRoom === room
                                    ? 'bg-indigo-400 text-white'
                                    : 'bg-gray-200 text-gray-600'
                                }
                            `}>
                                {getRoomCount(room)}
                            </span>
                        </button>
                    ))}
                </div>

                {specialRooms.length === 0 && (
                    <p className="text-gray-400 text-center py-4">
                        등록된 특별실이 없습니다. 기본 설정에서 추가해주세요.
                    </p>
                )}
            </div>

            {/* Room Timetable */}
            {selectedRoom && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        {selectedRoom} 사용 현황
                    </h3>
                    <TimetableGrid
                        assignments={assignments}
                        setAssignments={setAssignments}
                        filterRoom={selectedRoom}
                        grades={grades}
                    />

                    {/* Legend */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                            <span className="font-medium">셀 표시:</span> 학년-반 / 과목명
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
