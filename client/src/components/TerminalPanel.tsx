import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { X, Download, Play } from 'lucide-react';
import { InstanceWithRuntime } from '../types';
import { Socket } from 'socket.io-client';

interface TerminalPanelProps {
  instance: InstanceWithRuntime;
  socket: Socket | null;
  onClose: () => void;
  onStart: () => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ instance, socket, onClose, onStart }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentInstanceIdRef = useRef<string | null>(null);
  const prevProcessStateRef = useRef(instance.runtime.processState);

  // Initialize xterm.js once on mount
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#c0caf5',
        selectionBackground: '#33467c',
      },
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    // Delay initial fit to ensure container has dimensions
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle user keyboard input -> send to server
    term.onData((data: string) => {
      if (currentInstanceIdRef.current && socket) {
        socket.emit('pty:input', {
          instanceId: currentInstanceIdRef.current,
          data,
        });
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
      });
    });
    resizeObserver.observe(terminalRef.current);

    term.onResize(({ cols, rows }) => {
      if (currentInstanceIdRef.current && socket) {
        socket.emit('pty:resize', {
          instanceId: currentInstanceIdRef.current,
          cols,
          rows,
        });
      }
    });

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []); // mount once

  // Switch instances: detach old, clear terminal, attach new
  useEffect(() => {
    const term = xtermRef.current;
    if (!term || !socket) return;

    const prevId = currentInstanceIdRef.current;
    const newId = instance.id;

    // Detach from previous instance
    if (prevId && prevId !== newId) {
      socket.emit('pty:detach', { instanceId: prevId });
    }

    // Clear terminal and attach to new instance
    term.clear();
    term.reset();
    currentInstanceIdRef.current = newId;

    // Fit to get correct cols/rows before attaching
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }

    socket.emit('pty:attach', {
      instanceId: newId,
      cols: term.cols,
      rows: term.rows,
    });

    return () => {
      socket.emit('pty:detach', { instanceId: newId });
    };
  }, [instance.id, socket]);

  // Re-sync terminal size when instance transitions to running
  useEffect(() => {
    const prevState = prevProcessStateRef.current;
    prevProcessStateRef.current = instance.runtime.processState;

    if (prevState !== 'running' && instance.runtime.processState === 'running') {
      const term = xtermRef.current;
      const fitAddon = fitAddonRef.current;
      if (!term || !fitAddon || !socket) return;

      // Clear previous output, re-fit, then re-attach with correct dimensions
      term.clear();
      term.reset();
      requestAnimationFrame(() => {
        fitAddon.fit();
        socket.emit('pty:attach', {
          instanceId: instance.id,
          cols: term.cols,
          rows: term.rows,
        });
      });
    }
  }, [instance.runtime.processState, instance.id, socket]);

  // Listen for PTY data from server
  useEffect(() => {
    if (!socket) return;

    const handleData = ({ instanceId, data }: { instanceId: string; data: string }) => {
      if (instanceId === currentInstanceIdRef.current && xtermRef.current) {
        xtermRef.current.write(data);
      }
    };

    const handleScrollback = ({ instanceId, data }: { instanceId: string; data: string }) => {
      if (instanceId === currentInstanceIdRef.current && xtermRef.current) {
        xtermRef.current.write(data);
      }
    };

    const handleExit = ({ instanceId, exitCode }: { instanceId: string; exitCode: number }) => {
      if (instanceId === currentInstanceIdRef.current && xtermRef.current) {
        xtermRef.current.write(`\r\n\x1b[31m--- 进程已退出 (code ${exitCode}) ---\x1b[0m\r\n`);
      }
    };

    socket.on('pty:data', handleData);
    socket.on('pty:scrollback', handleScrollback);
    socket.on('pty:exit', handleExit);

    return () => {
      socket.off('pty:data', handleData);
      socket.off('pty:scrollback', handleScrollback);
      socket.off('pty:exit', handleExit);
    };
  }, [socket]);

  const handleDownloadLog = useCallback(() => {
    window.open(`/api/instances/${instance.id}/log`, '_blank');
  }, [instance.id]);

  const isRunning = instance.runtime.processState === 'running';

  return (
    <div className="flex flex-col h-full bg-gray-900 relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-sm truncate">{instance.name}</h2>
          <span className="text-xs text-gray-500 truncate block">
            {instance.workingDirectory}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleDownloadLog}
            className="text-gray-400 hover:text-white p-1"
            title="下载日志"
          >
            <Download size={16} />
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1" title="关闭">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div ref={terminalRef} className="flex-1 min-h-0 p-1" />

      {/* Start overlay when not running */}
      {!isRunning && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 z-10">
          <p className="text-gray-500 text-sm mb-4">终端未连接</p>
          <button
            onClick={onStart}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Play size={16} />
            启动实例
          </button>
        </div>
      )}
    </div>
  );
};
