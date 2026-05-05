'use client';
import { useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  placeholder?: string;
  height?: string;
}

const darkTheme = EditorView.theme({
  '&': { backgroundColor: '#0d1117', color: '#c9d1d9', fontSize: '13px' },
  '.cm-gutters': { backgroundColor: '#0d1117', color: '#484f58', border: 'none' },
  '.cm-activeLineGutter': { backgroundColor: '#161b22' },
  '.cm-activeLine': { backgroundColor: '#161b22' },
  '.cm-cursor': { borderLeftColor: '#58a6ff' },
  '.cm-selectionBackground': { backgroundColor: '#264f78' },
  '.cm-matchingBracket': { backgroundColor: '#1f2937', outline: '1px solid #374151' },
}, { dark: true });

export function SQLEditor({ value, onChange, onRun, placeholder = 'SELECT ...', height = '200px' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('SQL copied');
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun?.();
    }
  }, [onRun]);

  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-mono">SQL Editor</span>
          <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">PostgreSQL</span>
          {onRun && <span className="text-[10px] text-gray-600">Ctrl+Enter to run</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCopy} className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1">
            {copied ? <Check className="h-3 w-3 text-green-400"/> : <Copy className="h-3 w-3"/>}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[sql({ dialect: PostgreSQL }), darkTheme, EditorView.lineWrapping]}
        placeholder={placeholder}
        height={height}
        theme="dark"
        basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true, highlightActiveLine: true, bracketMatching: true }}
      />
    </div>
  );
}
