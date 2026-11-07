import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import hljs from 'highlight.js';
import { Check, Copy, Sparkles } from 'lucide-react';
import { inferArtifactTypeFromLang } from '../lib/artifactParser.js';

function CodeBlock({ language, value, onOpenAsArtifact }) {
  const [copied, setCopied] = useState(false);

  const highlighted = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(value, { language }).value;
      }
      return hljs.highlightAuto(value).value;
    } catch {
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }, [language, value]);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const canPreviewArtifact =
    value.trim().length > 30 &&
    (onOpenAsArtifact !== undefined);

  return (
    <div
      className="my-4 rounded-xl overflow-hidden border"
      style={{
        backgroundColor: 'var(--bg-code)',
        borderColor: 'rgba(255,255,255,0.1)',
      }}
    >
      <div
        className="flex items-center justify-between px-3.5 py-2 text-xs select-none"
        style={{
          backgroundColor: 'var(--bg-code-header)',
          color: '#B4B1A6',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span className="font-mono lowercase tracking-wide">{language || 'code'}</span>
        <div className="flex items-center gap-2">
          {canPreviewArtifact && (
            <button
              type="button"
              onClick={() =>
                onOpenAsArtifact({
                  id: `manual_${Date.now()}`,
                  identifier: `snippet-${language || 'code'}`,
                  title: `${(language || 'Code').toUpperCase()} Snippet`,
                  type: inferArtifactTypeFromLang(language, value),
                  language: language || 'text',
                  content: value,
                  version: 1,
                  totalVersions: 1,
                })
              }
              className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-white/10 text-[#E6E4DC] transition cursor-pointer"
              title="Open in Claude Artifacts side panel"
            >
              <Sparkles size={12} className="text-[#D97757]" />
              <span>Artifacts</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-white/10 text-[#E6E4DC] transition cursor-pointer"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      <pre className="p-4 m-0 overflow-x-auto text-[13.5px] leading-relaxed font-mono">
        <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

export default function MarkdownRenderer({ content, onOpenAsArtifact, className = '' }) {
  return (
    <div className={`claude-prose ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ inline, className: codeClass, children, ...props }) {
            const match = /language-([\w+-]+)/.exec(codeClass || '');
            const raw = String(children).replace(/\n$/, '');
            const isBlock = !inline && (match || raw.includes('\n'));

            if (isBlock) {
              return (
                <CodeBlock
                  language={match ? match[1] : ''}
                  value={raw}
                  onOpenAsArtifact={onOpenAsArtifact}
                />
              );
            }
            return (
              <code className={codeClass} {...props}>
                {children}
              </code>
            );
          },
          a({ href, children, ...props }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}
