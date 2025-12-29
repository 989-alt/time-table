import * as XLSX from 'xlsx';
import { DAYS, PERIODS } from './scheduler';

/**
 * Export timetable to Excel file
 */
export function exportToExcel(assignments, grades, specialRooms) {
    const workbook = XLSX.utils.book_new();

    // Create a sheet for each grade
    grades.forEach(grade => {
        if (grade.classCount === 0) return;

        for (let classId = 1; classId <= grade.classCount; classId++) {
            const classAssignments = assignments.filter(
                a => a.gradeId === grade.id && a.classId === classId
            );

            // Create grid data
            const data = [['교시', ...DAYS]];

            PERIODS.forEach(period => {
                const row = [`${period}교시`];
                DAYS.forEach(day => {
                    const assignment = classAssignments.find(
                        a => a.day === day && a.period === period
                    );
                    if (assignment) {
                        row.push(`${assignment.subjectName}\n(${assignment.moduleLocation})`);
                    } else {
                        row.push('');
                    }
                });
                data.push(row);
            });

            const worksheet = XLSX.utils.aoa_to_sheet(data);

            // Set column widths
            worksheet['!cols'] = [
                { wch: 8 },
                ...DAYS.map(() => ({ wch: 15 }))
            ];

            XLSX.utils.book_append_sheet(
                workbook,
                worksheet,
                `${grade.name} ${classId}반`
            );
        }
    });

    // Create room summary sheet
    specialRooms.forEach(room => {
        const roomAssignments = assignments.filter(a => a.moduleLocation === room);
        if (roomAssignments.length === 0) return;

        const data = [['교시', ...DAYS]];

        PERIODS.forEach(period => {
            const row = [`${period}교시`];
            DAYS.forEach(day => {
                const dayAssignments = roomAssignments.filter(
                    a => a.day === day && a.period === period
                );
                if (dayAssignments.length > 0) {
                    row.push(dayAssignments.map(a =>
                        `${a.gradeId}-${a.classId} ${a.subjectName}`
                    ).join('\n'));
                } else {
                    row.push('');
                }
            });
            data.push(row);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(data);
        worksheet['!cols'] = [
            { wch: 8 },
            ...DAYS.map(() => ({ wch: 20 }))
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, room);
    });

    // Generate and download
    XLSX.writeFile(workbook, '시간표.xlsx');
}
