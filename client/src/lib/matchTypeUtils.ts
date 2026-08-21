export const isExactMatchType = (matchType: string) => {
  const normalized = matchType.trim().toUpperCase();
  return normalized === "EXACT" || ["精确匹配", "精准匹配", "紧密匹配"].includes(matchType.trim());
};

export const canonicalMatchType = (matchType: string) => {
  const source = matchType.trim();
  const normalized = source.toUpperCase();
  if (isExactMatchType(source)) return "精确匹配";
  if (normalized === "BROAD" || source.includes("广泛")) return "广泛匹配";
  if (normalized === "PHRASE" || source.includes("短语") || source.includes("词组")) return "短语匹配";
  if (normalized === "AUTO" || ["CLOSE-MATCH", "LOOSE-MATCH", "SUBSTITUTES", "COMPLEMENTS"].includes(normalized) || ["紧密", "宽泛", "关联", "替代"].some((keyword) => source.includes(keyword))) return "自动匹配";
  if (normalized.startsWith("TARGETING_EXPRESSION") || normalized === "ASIN" || /^B0[A-Z0-9]{8,10}$/i.test(source) || /\bASIN\s*[=:]\s*["']?B0[A-Z0-9]{8,10}\b/i.test(source)) return "ASIN匹配";
  return source || "未知";
};
