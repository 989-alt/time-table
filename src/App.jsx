import React, { useState, useCallback } from 'react';
import { Settings, Calendar, Building2, Download, RefreshCw, School, BookOpen, ClipboardList } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import SettingsTab from './components/SettingsTab';
import GradeViewTab from './components/GradeViewTab';
import RoomViewTab from './components/RoomViewTab';
import ToastContainer from './components/Toast';
import ConfirmModal from './components/ConfirmModal';
import { exportToExcel } from './utils/excelExport';
import './index.css';

// Generate initial grades with UUIDs
const generateInitialGrades = () => [
  { id: uuidv4(), name: '1학년', classCount: 3, dailyMaxHours: [5, 5, 5, 5, 5] },
  { id: uuidv4(), name: '2학년', classCount: 3, dailyMaxHours: [5, 5, 5, 5, 5] },
  { id: uuidv4(), name: '3학년', classCount: 3, dailyMaxHours: [6, 6, 6, 6, 6] },
  { id: uuidv4(), name: '4학년', classCount: 3, dailyMaxHours: [6, 6, 6, 6, 6] },
  { id: uuidv4(), name: '5학년', classCount: 3, dailyMaxHours: [6, 6, 6, 6, 6] },
  { id: uuidv4(), name: '6학년', classCount: 3, dailyMaxHours: [6, 6, 6, 6, 6] },
];

// Special rooms now have capacity property for shared room support
const initialSpecialRooms = [
  { id: uuidv4(), name: '체육관', capacity: 1 },
  { id: uuidv4(), name: '운동장', capacity: 2 },  // Outdoor can have 2 classes
  { id: uuidv4(), name: '영어실', capacity: 1 },
  { id: uuidv4(), name: '과학실', capacity: 1 },
  { id: uuidv4(), name: '음악실', capacity: 2 }   // Large room, 2 classes
];

export default function App() {
  // Tab state
  const [activeTab, setActiveTab] = useState('settings');

  // Data state - grades now use UUIDs for dynamic management
  const [grades, setGrades] = useState(generateInitialGrades);
  const [specialRooms, setSpecialRooms] = useState(initialSpecialRooms);
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // Toast state
  const [toasts, setToasts] = useState([]);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, danger: false });

  const addToast = useCallback((message, type = 'success') => {
    const id = uuidv4();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showConfirm = useCallback((title, message, onConfirm, danger = false) => {
    setConfirmModal({ open: true, title, message, onConfirm, danger });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmModal({ open: false, title: '', message: '', onConfirm: null, danger: false });
  }, []);

  // Reset all data
  const handleReset = () => {
    showConfirm(
      '데이터 초기화',
      '모든 데이터를 초기화하시겠습니까?',
      () => {
        setGrades(generateInitialGrades());
        setSpecialRooms(initialSpecialRooms);
        setSubjects([]);
        setAssignments([]);
        setTeachers([]);
        closeConfirm();
        addToast('모든 데이터가 초기화되었습니다.', 'success');
      },
      true
    );
  };

  // Export to Excel
  const handleExport = () => {
    if (assignments.length === 0) {
      addToast('배정된 시간표가 없습니다.', 'warning');
      return;
    }
    exportToExcel(assignments, grades, specialRooms);
    addToast('Excel 파일이 다운로드되었습니다.', 'success');
  };

  const tabs = [
    { id: 'settings', label: '기본 설정', icon: Settings },
    { id: 'grade', label: '학년별 시간표', icon: Calendar },
    { id: 'room', label: '특별실 종합표', icon: Building2 },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <header className="flex-none bg-white shadow-sm z-10 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">전담 시간표 편성</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Elementary Specialist Scheduler</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-1 bg-gray-100 p-1 rounded-lg order-last md:order-none w-full md:w-auto justify-center">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2
                    ${activeTab === tab.id
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5"
              aria-label="Excel 내보내기"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Excel 내보내기</span>
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
              aria-label="초기화"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">초기화</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-12">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'settings' && (
            <SettingsTab
              grades={grades}
              setGrades={setGrades}
              subjects={subjects}
              setSubjects={setSubjects}
              specialRooms={specialRooms}
              setSpecialRooms={setSpecialRooms}
              setAssignments={setAssignments}
              teachers={teachers}
              setTeachers={setTeachers}
              addToast={addToast}
              showConfirm={showConfirm}
              closeConfirm={closeConfirm}
            />
          )}

          {activeTab === 'grade' && (
            <GradeViewTab
              grades={grades}
              subjects={subjects}
              assignments={assignments}
              setAssignments={setAssignments}
              specialRooms={specialRooms}
              teachers={teachers}
              addToast={addToast}
              showConfirm={showConfirm}
              closeConfirm={closeConfirm}
            />
          )}

          {activeTab === 'room' && (
            <RoomViewTab
              specialRooms={specialRooms}
              assignments={assignments}
              setAssignments={setAssignments}
              grades={grades}
            />
          )}
        </div>
      </main>

      {/* Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-4 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <School className="w-3.5 h-3.5 text-gray-400" />
              학년: <strong className="text-gray-700">{grades.length}개</strong>
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-gray-400" />
              과목: <strong className="text-gray-700">{subjects.length}개</strong>
            </span>
            <span className="flex items-center gap-1">
              <ClipboardList className="w-3.5 h-3.5 text-gray-400" />
              배정: <strong className="text-gray-700">{assignments.length}건</strong>
            </span>
          </div>
          <div className="text-gray-400 hidden sm:block">
            &copy; 2025 Elementary Specialist Scheduler
          </div>
        </div>
      </footer>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Confirm modal */}
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
        danger={confirmModal.danger}
      />
    </div>
  );
}
