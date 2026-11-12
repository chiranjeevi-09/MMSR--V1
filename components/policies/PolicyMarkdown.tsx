'use client';

import React from 'react';

/**
 * Safe, allowlist Markdown renderer for policy content.
 *
 * This component NEVER uses dangerouslySetInnerHTML. It parses a restricted subset of
 * Markdown (headings, ordered/unordered lists, links, bold/italic, paragraphs) into real
 * React elements. Any raw HTML in the source is treated as literal escaped text, so it
 * cannot execute scripts or inject markup. Link hrefs are validated against an allowlist
 * of safe schemes to block `javascript:`/`data:` URLs.
 */

// ── Inline parsing (bold, italic, links) ─────────────────────────────────────

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/)/i;

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed.toLowerCase().startsWith('javascript:') || trimmed.toLowerCase().startsWith('data:')) {
    return false;
  }
  return SAFE_HREF.test(trimmed);
}

type InlineNode = React.ReactNode;

function renderInline(text: string, keyPrefix: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  // Order matters: links first (they may contain formatting), then bold, then italic.
  const pattern = /(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(_[^_]+_)|(\*[^*]+\*)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-inline-${i++}`;

    if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        if (isSafeHref(href)) {
          const external = /^https?:\/\//i.test(href);
          nodes.push(
            <a
              key={key}
              href={href}
              className="text-gold-500 underline underline-offset-2 hover:text-gold-600 break-words"
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {renderInline(label, `${key}-label`)}
            </a>
          );
        } else {
          // Unsafe link: render the visible label as plain text, drop the target.
          nodes.push(label);
        }
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-bold text-ivory-white">
          {renderInline(token.slice(2, -2), `${key}-b`)}
        </strong>
      );
    } else {
      // _italic_ or *italic*
      nodes.push(
        <em key={key} className="italic">
          {renderInline(token.slice(1, -1), `${key}-i`)}
        </em>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

// ── Block parsing ────────────────────────────────────────────────────────────

function headingLevel(marker: string): number {
  return marker.length; // number of leading '#'
}

export interface PolicyMarkdownProps {
  content: string;
  className?: string;
}

export const PolicyMarkdown: React.FC<PolicyMarkdownProps> = ({ content, className }) => {
  const lines = (content || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];

  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      const text = paragraph.join(' ');
      blocks.push(
        <p key={`p-${key++}`} className="text-sm sm:text-[15px] leading-relaxed text-text-muted">
          {renderInline(text, `p-${key}`)}
        </p>
      );
      paragraph = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType;
      blocks.push(
        <ListTag
          key={`l-${key++}`}
          className={`space-y-1.5 pl-5 text-sm sm:text-[15px] leading-relaxed text-text-muted ${
            listType === 'ul' ? 'list-disc' : 'list-decimal'
          }`}
        >
          {listItems.map((item, idx) => (
            <li key={`li-${key}-${idx}`}>{renderInline(item, `li-${key}-${idx}`)}</li>
          ))}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    const trimmed = line.trim();

    if (trimmed === '') {
      flushList();
      flushParagraph();
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushList();
      flushParagraph();
      blocks.push(<hr key={`hr-${key++}`} className="border-t border-[#D4AC54]/50 my-2" />);
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      flushList();
      flushParagraph();
      const level = Math.min(Math.max(headingLevel(headingMatch[1]), 2), 4);
      const text = headingMatch[2];
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const cls =
        level === 2
          ? 'text-xl sm:text-2xl font-bold font-playfair text-gold-400 mt-2'
          : level === 3
          ? 'text-lg font-bold font-playfair text-ivory-white'
          : 'text-base font-bold text-ivory-white';
      if (level === 2) {
        blocks.push(
          <h2 key={`h-${key++}`} id={id} className={cls}>
            {renderInline(text, `h-${key}`)}
          </h2>
        );
      } else if (level === 3) {
        blocks.push(
          <h3 key={`h-${key++}`} id={id} className={cls}>
            {renderInline(text, `h-${key}`)}
          </h3>
        );
      } else {
        blocks.push(
          <h4 key={`h-${key++}`} id={id} className={cls}>
            {renderInline(text, `h-${key}`)}
          </h4>
        );
      }
      continue;
    }

    // List items
    const ulMatch = /^[-*]\s+(.*)$/.exec(trimmed);
    const olMatch = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (ulMatch || olMatch) {
      flushParagraph();
      const type: 'ul' | 'ol' = ulMatch ? 'ul' : 'ol';
      if (listType && listType !== type) {
        flushList();
      }
      listType = type;
      listItems.push((ulMatch || olMatch)![1]);
      continue;
    }

    // Ordinary paragraph text
    flushList();
    paragraph.push(trimmed);
  }

  flushList();
  flushParagraph();

  return (
    <div className={className}>
      <div className="space-y-4">{blocks}</div>
    </div>
  );
};

export default PolicyMarkdown;
