import React from 'react';

interface StatusBadgeProps {
  state: string;
  outputting?: boolean;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  idle: { color: 'bg-gray-500', label: '空闲' },
  running: { color: 'bg-green-500', label: '运行中' },
  stopped: { color: 'bg-yellow-500', label: '已停止' },
  error: { color: 'bg-red-500', label: '错误' },
};

const WORKING_TEXT = '正在工作';

export const StatusBadge: React.FC<StatusBadgeProps> = ({ state, outputting }) => {
  const isOutputting = state === 'running' && outputting;
  const config = STATUS_CONFIG[state] || STATUS_CONFIG.idle;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      {isOutputting ? (
        <span className="inline-flex text-green-400">
          {[...WORKING_TEXT].map((ch, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                animation: `wave-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
              }}
            >
              {ch}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-gray-400">{config.label}</span>
      )}
    </span>
  );
};
