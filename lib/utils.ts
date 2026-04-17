import { Grade } from './types';

// JackpotDaily brand-aligned grade colors
export function gradeColor(grade: Grade): string {
  switch (grade) {
    case 'A': return '#00C882'; // Winner Green
    case 'B': return '#E91E8C'; // Hot Pink
    case 'C': return '#FFD600'; // Gold Yellow
    case 'D': return '#f97316'; // Orange
    case 'F': return '#FF4444'; // Alert Red
    case 'N/A': return '#6b7280'; // Gray
    default: return '#6b7280';
  }
}

export function gradeBg(grade: Grade): string {
  switch (grade) {
    case 'A': return 'bg-[#00C882]/20 text-[#00C882] border border-[#00C882]/40';
    case 'B': return 'bg-[#E91E8C]/20 text-[#E91E8C] border border-[#E91E8C]/40';
    case 'C': return 'bg-[#FFD600]/20 text-[#FFD600] border border-[#FFD600]/40';
    case 'D': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    case 'F': return 'bg-[#FF4444]/20 text-[#FF4444] border border-[#FF4444]/40';
    case 'N/A': return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
  }
}

export function scoreToGrade(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

export function formatShortDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric'
  });
}
