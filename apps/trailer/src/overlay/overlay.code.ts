import { colors } from './overlay.tokens.ts';

/**
 * A deliberately small JavaScript tokenizer for the on-screen code panel.
 *
 * Highlighting exists here to make the code read as code at a glance — nobody
 * pauses a trailer to study a scope chain. So this handles the six things that
 * carry that impression and nothing else; no ASI, no regex literals, no nesting.
 *
 * The colours are the game's own tokens rather than an editor theme, so the panel
 * still belongs to the same world as the board behind it.
 */
type TokenKind = 'comment' | 'keyword' | 'number' | 'plain' | 'punct' | 'string';

type Token = {
  kind: TokenKind;
  value: string;
};

const keywords = new Set([
  'const',
  'let',
  'var',
  'if',
  'else',
  'return',
  'new',
  'function',
  'true',
  'false',
  'null',
  'undefined',
  'typeof',
  'of',
  'in',
]);

const tokenPattern =
  /(\/\/[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([{}()[\].,;:?!<>=+\-*/&|%]+)/g;

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(tokenPattern)) {
    const [value, comment, string, number, word, punct] = match;
    if (match.index > lastIndex) {
      tokens.push({ kind: 'plain', value: source.slice(lastIndex, match.index) });
    }
    if (comment) {
      tokens.push({ kind: 'comment', value });
    } else if (string) {
      tokens.push({ kind: 'string', value });
    } else if (number) {
      tokens.push({ kind: 'number', value });
    } else if (word) {
      tokens.push({ kind: keywords.has(word) ? 'keyword' : 'plain', value });
    } else if (punct) {
      tokens.push({ kind: 'punct', value });
    }
    lastIndex = match.index + value.length;
  }

  if (lastIndex < source.length) {
    tokens.push({ kind: 'plain', value: source.slice(lastIndex) });
  }
  return tokens;
};

const tokenColors: Record<TokenKind, string> = {
  comment: colors.inkFaint,
  keyword: colors.system,
  number: colors.energy,
  plain: colors.ink,
  punct: colors.inkDim,
  string: colors.acid,
};

/** Splits `source` into lines of tokens, so the panel can number and clip them. */
const tokenizeLines = (source: string): Token[][] => source.split('\n').map((line) => tokenize(line));

/**
 * The first `count` characters of a tokenized document, for the typing reveal.
 * Counting characters rather than tokens keeps the cadence even regardless of how
 * the tokenizer happened to split a line.
 */
const clipLines = (lines: Token[][], count: number): Token[][] => {
  let budget = count;
  const clipped: Token[][] = [];

  for (const line of lines) {
    if (budget <= 0) {
      break;
    }
    const clippedLine: Token[] = [];
    for (const token of line) {
      if (budget <= 0) {
        break;
      }
      clippedLine.push(budget >= token.value.length ? token : { ...token, value: token.value.slice(0, budget) });
      budget -= token.value.length;
    }
    clipped.push(clippedLine);
    // The newline itself costs a character, or long files reveal a line too fast.
    budget -= 1;
  }
  return clipped;
};

const countCharacters = (lines: Token[][]): number =>
  lines.reduce((total, line) => total + line.reduce((sum, token) => sum + token.value.length, 0) + 1, 0);

export type { Token, TokenKind };
export { clipLines, countCharacters, tokenColors, tokenizeLines };
