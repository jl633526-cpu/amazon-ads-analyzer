export const isExactMatchType = (matchType: string) => {
  const normalized = matchType.trim().toUpperCase();
  return normalized === "EXACT" || ["精确匹配", "精准匹配", "紧密匹配"].includes(matchType.trim());
};
