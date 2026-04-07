import { useMemo } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  fileName?: string
  className?: string
}

const getMonacoLanguage = (fileName?: string): string => {
  if (!fileName) return 'typescript'

  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    json: 'json',
    py: 'python',
    pyw: 'python',
    xml: 'xml',
    svg: 'xml',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    sh: 'shell',
    bash: 'shell',
  }

  return languageMap[ext] || 'plaintext'
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  disabled = false,
  fileName,
  className = '',
}) => {
  const language = useMemo(() => getMonacoLanguage(fileName), [fileName])

  const handleEditorMount: OnMount = (_, monaco) => {
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    })
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    })
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      strict: false,
    })
  }

  const editorOptions: MonacoEditor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
    automaticLayout: true,
    formatOnPaste: true,
    formatOnType: true,
    wordWrap: 'off',
    scrollBeyondLastLine: false,
    renderWhitespace: 'selection',
    tabSize: 2,
    insertSpaces: true,
    quickSuggestions: true,
    suggestOnTriggerCharacters: true,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    glyphMargin: true,
    folding: true,
    lineNumbers: 'on',
    readOnly: disabled,
  }

  return (
    <Editor
      value={value}
      defaultLanguage={language}
      language={language}
      theme="vs-dark"
      height="420px"
      options={editorOptions}
      onMount={handleEditorMount}
      onChange={(nextValue) => onChange(nextValue ?? '')}
      className={`code-editor-container ${className}`}
    />
  )
}
