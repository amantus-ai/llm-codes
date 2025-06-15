import { describe, it, expect } from 'vitest';
import {
  extractCodeBlocks,
  formatCodeBlocksAsMarkdown,
  extractOnlyCodeBlocks,
} from '../code-extraction';

describe('code-extraction', () => {
  describe('extractCodeBlocks', () => {
    it('should extract properly closed code blocks', () => {
      const markdown = `
# Example

Here's some code:

\`\`\`javascript
const hello = "world";
console.log(hello);
\`\`\`

And more text.
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('javascript');
      expect(blocks[0].code).toBe('const hello = "world";\nconsole.log(hello);');
      expect(blocks[0].isUnclosed).toBeFalsy();
    });

    it('should handle unclosed code blocks with header detection', () => {
      const markdown = `
# Example

\`\`\`python
def hello():
    print("world")

# Another Section

This is more content.
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('python');
      expect(blocks[0].code).toBe('def hello():\n    print("world")');
      expect(blocks[0].isUnclosed).toBe(true);
    });

    it('should handle unclosed code blocks at end of file', () => {
      const markdown = `
Some text

\`\`\`bash
npm install
npm run dev
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('bash');
      expect(blocks[0].code).toBe('npm install\nnpm run dev');
      expect(blocks[0].isUnclosed).toBe(true);
    });

    it('should detect unclosed blocks before lists', () => {
      const markdown = `
\`\`\`js
const x = 1;

* First item
* Second item
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toBe('const x = 1;');
      expect(blocks[0].isUnclosed).toBe(true);
    });

    it('should handle multiple code blocks with mixed closure', () => {
      const markdown = `
\`\`\`json
{
  "name": "test"
}
\`\`\`

\`\`\`yaml
name: test
version: 1.0

## Configuration

More content here.
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(2);

      expect(blocks[0].language).toBe('json');
      expect(blocks[0].isUnclosed).toBeFalsy();

      expect(blocks[1].language).toBe('yaml');
      expect(blocks[1].code).toBe('name: test\nversion: 1.0');
      expect(blocks[1].isUnclosed).toBe(true);
    });

    it('should handle code blocks with no language specified', () => {
      const markdown = `
\`\`\`
plain text code
\`\`\`
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBeUndefined();
      expect(blocks[0].code).toBe('plain text code');
    });

    it('should skip empty code blocks', () => {
      const markdown = `
\`\`\`javascript

\`\`\`

\`\`\`python
# Has content
print("hello")
\`\`\`
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('python');
    });

    it('should detect horizontal rules as block end', () => {
      const markdown = `
\`\`\`ruby
puts "Hello"

---

More content
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toBe('puts "Hello"');
      expect(blocks[0].isUnclosed).toBe(true);
    });

    it('should detect table as block end', () => {
      const markdown = `
\`\`\`sql
SELECT * FROM users

| Column | Type |
|--------|------|
| id     | int  |
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toBe('SELECT * FROM users');
      expect(blocks[0].isUnclosed).toBe(true);
    });
  });

  describe('formatCodeBlocksAsMarkdown', () => {
    it('should format code blocks grouped by language', () => {
      const blocks = [
        { code: 'const x = 1;', language: 'javascript', startLine: 1, endLine: 3 },
        { code: 'print("hi")', language: 'python', startLine: 5, endLine: 7 },
        { code: 'const y = 2;', language: 'javascript', startLine: 9, endLine: 11 },
      ];

      const formatted = formatCodeBlocksAsMarkdown(blocks);
      expect(formatted).toContain('# Code Examples');
      expect(formatted).toContain('## Javascript Examples');
      expect(formatted).toContain('## Python Examples');
      expect(formatted).toContain('### Example 1');
      expect(formatted).toContain('### Example 2');
    });

    it('should show warning for unclosed blocks', () => {
      const blocks = [
        { code: 'test', language: 'bash', startLine: 1, endLine: 3, isUnclosed: true },
      ];

      const formatted = formatCodeBlocksAsMarkdown(blocks);
      expect(formatted).toContain('**Note**: 1 code block was detected as potentially unclosed');
    });

    it('should handle multiple unclosed blocks', () => {
      const blocks = [
        { code: 'test1', language: 'bash', startLine: 1, endLine: 3, isUnclosed: true },
        { code: 'test2', language: 'python', startLine: 5, endLine: 7, isUnclosed: true },
      ];

      const formatted = formatCodeBlocksAsMarkdown(blocks);
      expect(formatted).toContain('**Note**: 2 code blocks were detected as potentially unclosed');
    });

    it('should handle no code blocks', () => {
      const formatted = formatCodeBlocksAsMarkdown([]);
      expect(formatted).toContain('No code blocks found');
    });

    it('should handle blocks without language', () => {
      const blocks = [{ code: 'generic code', startLine: 1, endLine: 3 }];

      const formatted = formatCodeBlocksAsMarkdown(blocks);
      expect(formatted).toContain('## Other Code Examples');
    });
  });

  describe('extractOnlyCodeBlocks', () => {
    it('should extract and format all code blocks', () => {
      const markdown = `
# Documentation

Some text here.

\`\`\`python
def main():
    pass
\`\`\`

More text.

\`\`\`bash
echo "Hello"

# Another section
`;

      const result = extractOnlyCodeBlocks(markdown);
      expect(result).toContain('# Code Examples');
      expect(result).toContain('```python');
      expect(result).toContain('def main():');
      expect(result).toContain('```bash');
      expect(result).toContain('echo "Hello"');
      expect(result).not.toContain('(auto-detected end)');
    });
  });

  describe('edge cases and extensive scenarios', () => {
    it('should handle nested code block markers', () => {
      const markdown = `
\`\`\`markdown
# Example
\`\`\`javascript
console.log("nested");
\`\`\`
\`\`\`
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('markdown');
      expect(blocks[0].code).toContain('```javascript');
    });

    it('should handle code blocks with trailing content on opening line', () => {
      const markdown = `
\`\`\`python # This is a comment
def hello():
    pass
\`\`\`
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('python');
      expect(blocks[0].code.trim()).toBe('def hello():\n    pass');
    });

    it('should handle consecutive code blocks', () => {
      const markdown = `
\`\`\`js
const a = 1;
\`\`\`
\`\`\`js
const b = 2;
\`\`\`
\`\`\`js
const c = 3;
\`\`\`
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(3);
      blocks.forEach((block, idx) => {
        expect(block.language).toBe('js');
        expect(block.code).toBe(`const ${String.fromCharCode(97 + idx)} = ${idx + 1};`);
      });
    });

    it('should handle code blocks with various documentation markers', () => {
      const markdown = `
\`\`\`typescript
function test() {
  return true;

Parameters:
- none

Returns:
- boolean
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].code.trim()).toBe('function test() {\n  return true;');
      expect(blocks[0].isUnclosed).toBe(true);
    });

    it('should handle very long code blocks', () => {
      const longCode = Array(100)
        .fill(0)
        .map((_, i) => `const line${i} = ${i};`)
        .join('\n');
      const markdown = `\`\`\`javascript\n${longCode}\n\`\`\``;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toBe(longCode);
      expect(blocks[0].code.split('\n')).toHaveLength(100);
    });

    it('should handle code blocks with special characters', () => {
      const markdown = `
\`\`\`bash
echo "Hello $USER"
grep -E '^[a-z]+$' file.txt
awk '{print $1}' data.csv
\`\`\`
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toContain('$USER');
      expect(blocks[0].code).toContain('^[a-z]+$');
      expect(blocks[0].code).toContain('{print $1}');
    });

    it('should handle indented code blocks', () => {
      const markdown = `
Some text:

    \`\`\`python
    def indented():
        return True
    \`\`\`
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('python');
      // Note: indentation inside the code block is preserved
      expect(blocks[0].code).toContain('    def indented():');
    });

    it('should handle code blocks interrupted by various markers', () => {
      const testCases = [
        {
          markdown: `\`\`\`js\ncode\n\n---\nMore content`,
          expectedCode: 'code',
          description: 'horizontal rule',
        },
        {
          markdown: `\`\`\`js\ncode\n\n| Col1 | Col2 |\n|------|------|`,
          expectedCode: 'code',
          description: 'table',
        },
        {
          markdown: `\`\`\`js\ncode\n\n> Blockquote`,
          expectedCode: 'code\n\n> Blockquote',
          description: 'blockquote (not a terminator)',
        },
        {
          markdown: `\`\`\`js\ncode\n\nImportant: This is important`,
          expectedCode: 'code',
          description: 'Important: marker',
        },
      ];

      testCases.forEach(({ markdown, expectedCode, description }) => {
        const blocks = extractCodeBlocks(markdown);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].code.trim()).toBe(expectedCode.trim());
        if (description !== 'blockquote (not a terminator)') {
          expect(blocks[0].isUnclosed).toBe(true);
        }
      });
    });

    it('should format code blocks with mixed languages correctly', () => {
      const blocks = [
        { code: 'SELECT * FROM users;', language: 'sql', startLine: 1, endLine: 3 },
        { code: '<div>Hello</div>', language: 'html', startLine: 5, endLine: 7 },
        { code: '.class { color: red; }', language: 'css', startLine: 9, endLine: 11 },
        { code: 'def hello(): pass', language: 'python', startLine: 13, endLine: 15 },
        { code: 'console.log(42);', language: 'javascript', startLine: 17, endLine: 19 },
      ];

      const formatted = formatCodeBlocksAsMarkdown(blocks);

      // Check language order (alphabetical)
      const languageOrder = ['Css', 'Html', 'Javascript', 'Python', 'Sql'];
      languageOrder.forEach((lang) => {
        const pattern = new RegExp(`## ${lang} Examples`);
        expect(formatted).toMatch(pattern);
      });

      // Verify all code is present
      expect(formatted).toContain('SELECT * FROM users;');
      expect(formatted).toContain('<div>Hello</div>');
      expect(formatted).toContain('.class { color: red; }');
      expect(formatted).toContain('def hello(): pass');
      expect(formatted).toContain('console.log(42);');
    });

    it('should handle empty input gracefully', () => {
      expect(extractCodeBlocks('')).toEqual([]);
      expect(extractOnlyCodeBlocks('')).toContain('No code blocks found');
    });

    it('should handle input with no code blocks', () => {
      const markdown = `
# Documentation

This is just regular text without any code examples.

## Section 2

More text here.
`;

      expect(extractCodeBlocks(markdown)).toEqual([]);
      expect(extractOnlyCodeBlocks(markdown)).toContain('No code blocks found');
    });

    it('should preserve code block content exactly', () => {
      const markdown = `
\`\`\`python
   # Indented comment
def func():
\tpass  # Tab character
    
  # Extra spaces  
\`\`\`
`;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks[0].code).toBe(
        '   # Indented comment\ndef func():\n\tpass  # Tab character\n    \n  # Extra spaces  '
      );
    });
  });
});
