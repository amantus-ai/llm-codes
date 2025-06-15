export interface CodeBlock {
  code: string;
  language?: string;
  startLine: number;
  endLine: number;
  isUnclosed?: boolean;
}

/**
 * Detects if a line likely marks the end of an unclosed code block
 */
function isLikelyCodeBlockEnd(line: string): boolean {
  const trimmed = line.trim();

  // Empty line doesn't end a code block
  if (!trimmed) return false;

  // Headers - but only if the line isn't indented (to avoid matching code comments)
  if (line.match(/^#{1,6}\s/) && !line.match(/^\s+#/)) return true;

  // Horizontal rules
  if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) return true;

  // Bullet points or numbered lists at start of line (not indented)
  if (line.match(/^(\*|-|\+|\d+\.)\s/)) return true;

  // Common documentation section starters (must be at start of line)
  if (
    line.match(
      /^(##\s|###\s|####\s|#####\s|######\s|Parameters:|Returns:|Example:|Note:|Warning:|Tip:|Important:)/i
    )
  )
    return true;

  // Table indicators
  if (/^\|/.test(trimmed) || /^[\s]*\|?[\s]*:?-+:?[\s]*\|/.test(line)) return true;

  return false;
}

/**
 * Extracts all code blocks from markdown content, handling malformed blocks
 */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
  const lines = markdown.split('\n');
  const codeBlocks: CodeBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for code block start
    if (trimmed.startsWith('```')) {
      const startLine = i;
      // Extract language, handling cases like ```python # comment
      const languageMatch = trimmed.slice(3).match(/^\s*([^\s]+)/);
      const language = languageMatch ? languageMatch[1] : undefined;
      const codeLines: string[] = [];
      let isUnclosed = false;

      i++; // Move past the opening ```

      // Collect code lines until we find a closing ``` or likely end
      while (i < lines.length) {
        const currentLine = lines[i];
        const currentTrimmed = currentLine.trim();

        // Check for explicit closing (only if it's just ``` with no language)
        if (currentTrimmed === '```') {
          // Found closing marker
          i++; // Move past the closing ```
          break;
        }

        // Check for implicit end of code block (for unclosed blocks)
        if (codeLines.length > 0 && isLikelyCodeBlockEnd(currentLine)) {
          // Don't include this line in the code block
          isUnclosed = true;
          break;
        }

        // Add line to code block
        codeLines.push(currentLine);
        i++;
      }

      // If we exited the loop without finding a closing marker, it's unclosed
      if (i >= lines.length && !isUnclosed) {
        isUnclosed = true;
      }

      // Only add non-empty code blocks
      if (codeLines.length > 0 || (codeLines.length === 0 && !isUnclosed)) {
        // For unclosed blocks, handle trailing newlines
        if (isUnclosed && codeLines.length > 0) {
          // If ended at EOF, the last line might have a trailing newline from split
          if (i >= lines.length && codeLines[codeLines.length - 1] === '') {
            codeLines.pop();
          }
          // If ended due to detection, remove empty line before the marker
          else if (i < lines.length && codeLines[codeLines.length - 1] === '') {
            codeLines.pop();
          }
        }

        // For closed blocks, remove only completely empty trailing lines
        // This preserves lines that contain only whitespace
        if (!isUnclosed) {
          while (codeLines.length > 0 && codeLines[codeLines.length - 1] === '') {
            codeLines.pop();
          }
        }

        if (codeLines.length > 0) {
          codeBlocks.push({
            code: codeLines.join('\n'),
            language,
            startLine: startLine + 1, // 1-indexed for user display
            endLine: i,
            isUnclosed,
          });
        }
      }
    } else {
      i++;
    }
  }

  return codeBlocks;
}

/**
 * Formats code blocks back into markdown format
 */
export function formatCodeBlocksAsMarkdown(codeBlocks: CodeBlock[]): string {
  if (codeBlocks.length === 0) {
    return '# No code blocks found\n\nThe documentation does not contain any code examples.';
  }

  const sections: string[] = [];

  // Group by language if multiple languages exist
  const byLanguage = new Map<string, CodeBlock[]>();
  const noLanguage: CodeBlock[] = [];

  for (const block of codeBlocks) {
    if (block.language) {
      const existing = byLanguage.get(block.language) || [];
      existing.push(block);
      byLanguage.set(block.language, existing);
    } else {
      noLanguage.push(block);
    }
  }

  // Add header
  sections.push('# Code Examples\n');

  // Add warning if there were unclosed blocks
  const unclosedCount = codeBlocks.filter((b) => b.isUnclosed).length;
  if (unclosedCount > 0) {
    sections.push(
      `> **Note**: ${unclosedCount} code block${unclosedCount > 1 ? 's were' : ' was'} detected as potentially unclosed and extracted using heuristics.\n`
    );
  }

  // Format blocks by language
  if (byLanguage.size > 0) {
    const sortedLanguages = Array.from(byLanguage.keys()).sort();

    for (const lang of sortedLanguages) {
      const blocks = byLanguage.get(lang)!;
      sections.push(`## ${lang.charAt(0).toUpperCase() + lang.slice(1)} Examples\n`);

      blocks.forEach((block, index) => {
        if (blocks.length > 1) {
          sections.push(`### Example ${index + 1}\n`);
        }
        sections.push('```' + lang);
        sections.push(block.code);
        sections.push('```\n');
      });
    }
  }

  // Add blocks without language
  if (noLanguage.length > 0) {
    sections.push('## Other Code Examples\n');

    noLanguage.forEach((block, index) => {
      if (noLanguage.length > 1) {
        sections.push(`### Example ${index + 1}\n`);
      }
      sections.push('```');
      sections.push(block.code);
      sections.push('```\n');
    });
  }

  return sections.join('\n');
}

/**
 * Extracts only code blocks from markdown, returning formatted markdown with just the code
 */
export function extractOnlyCodeBlocks(markdown: string): string {
  const codeBlocks = extractCodeBlocks(markdown);
  return formatCodeBlocksAsMarkdown(codeBlocks);
}
