import { Grade } from './types';

export function gradeColor(grade: Grade): string {
  switch (grade) {
    case 'A': return '#22c55e';
    case 'B': return '#3b82f6';
    case 'C': return '#f59e0b';
    case 'D': return '#f97316';
    case 'F': return '#ef4444';
  }
}

export function gradeBg(grade: Grade): string {
  switch (grade) {
    case 'A': return 'bg-green-500/20 text-green-400 border border-green-500/30';
    case 'B': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    case 'C': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    case 'D': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    case 'F': return 'bg-red-500/20 text-red-400 border border-red-500/30';
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
