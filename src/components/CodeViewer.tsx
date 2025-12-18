import React from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeViewerProps {
  code: string
  language?: string
}

const CodeViewer: React.FC<CodeViewerProps> = ({ code, language = 'javascript' }) => {
  return (
    <div data-testid="syntax-highlighter">
      <SyntaxHighlighter language={language} style={oneDark} wrapLongLines>
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

export default CodeViewer
