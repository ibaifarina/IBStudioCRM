import type { Tag } from "@/lib/types";

const STOP_WORDS = new Set(["de", "del", "la", "las", "el", "los", "y", "i"]);

function singularize(token: string) {
  if (token.length <= 4) return token;
  if (token.endsWith("es") && token.length > 6) return token.slice(0, -2);
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

export function normalizeTagName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token))
    .map(singularize)
    .join(" ");
}

function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution =
        previous[rightIndex - 1] +
        (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        substitution
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function tokenDiceScore(left: string, right: string) {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return (2 * overlap) / (leftTokens.size + rightTokens.size);
}

function similarityScore(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const editScore =
    1 - levenshteinDistance(left, right) / Math.max(left.length, right.length);
  const wordScore = tokenDiceScore(left, right);
  return Math.max(editScore, wordScore);
}

function similarityThreshold(value: string) {
  if (value.length >= 8) return 0.82;
  if (value.length >= 5) return 0.86;
  return 0.94;
}

export type SimilarTagMatch = {
  tag: Tag;
  score: number;
  exact: boolean;
};

export function findSimilarTag(
  candidate: string,
  tags: Tag[]
): SimilarTagMatch | null {
  const normalizedCandidate = normalizeTagName(candidate);
  if (!normalizedCandidate) return null;

  const ranked = tags
    .map((tag) => {
      const normalizedTag = normalizeTagName(tag.name);
      return {
        tag,
        score: similarityScore(normalizedCandidate, normalizedTag),
        exact: normalizedCandidate === normalizedTag,
      };
    })
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  if (!best || best.score < similarityThreshold(normalizedCandidate)) return null;
  return best;
}
