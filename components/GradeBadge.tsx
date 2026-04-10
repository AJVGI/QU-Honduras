import { Grade } from '@/lib/types';
import { gradeBg } from '@/lib/utils';

export function GradeBadge({ grade, size = 'sm' }: { grade: Grade; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg'
    ? 'text-2xl font-black px-4 py-1 rounded-xl'
    : 'text-xs font-bold px-2 py-0.5 rounded-md';
  return (
    <span className={`${gradeBg(grade)} ${cls} font-mono`}>{grade}</span>
  );
}
