import Editor from '@monaco-editor/react';
import { useEffect, useRef } from 'react';

const CodeEditor = ({ language, setLanguage, code, setCode, onRun, onSubmit, isEvaluating, errorLine }) => {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]); // Tracks active highlights so we can clear them

  // Switching languages only swaps which language is active -- Arena keeps a per-language
  // code map and derives `code` from it, so the previous language's progress is preserved
  // rather than overwritten here.
  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  // Listen for changes to the errorLine prop
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      if (errorLine) {
        // Add the highlight decoration
        decorationsRef.current = editorRef.current.deltaDecorations(
          decorationsRef.current, // Clear the previous decoration (if any)
          [
            {
              range: new monacoRef.current.Range(errorLine, 1, errorLine, 1),
              options: {
                isWholeLine: true,
                className: 'error-line-highlight',
                glyphMarginClassName: 'error-glyph-margin' // Adds a margin indicator
              }
            }
          ]
        );

        // Scrolls the editor to the error line automatically
        editorRef.current.revealLineInCenter(errorLine);
      } else {
        // If errorLine is null, clear all active decorations
        decorationsRef.current = editorRef.current.deltaDecorations(
          decorationsRef.current,
          []
        );
      }
    }
  }, [errorLine]);

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">

      {/* Editor Toolbar */}
      <div className="flex justify-between items-center bg-gray-800 px-4 py-2 border-b border-gray-700">
        <select
          value={language}
          onChange={handleLanguageChange}
          className="bg-gray-700 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="c">C</option>
          <option value="cpp">C++</option>
          <option value="java">Java</option>
        </select>

        <div className="space-x-3">
          <button
            onClick={onRun}
            disabled={isEvaluating}
            className="bg-gray-600 hover:bg-gray-500 text-gray-200 px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            Run Code
          </button>
          <button
            onClick={onSubmit}
            disabled={isEvaluating}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </div>

      {/* The Monaco Editor */}
      <div className="grow pt-2">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value)}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: 'on',
            glyphMargin: true, // Enables the margin for error indicators
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditor;