export function highlight(text, keywords) {
  if (!text || typeof text !== 'string') return text;

  const keywordList = Object.values(keywords)
    .filter(kw => kw && kw.keyword && typeof kw.keyword === 'string')
    .sort((a, b) => b.keyword.length - a.keyword.length);

  if (keywordList.length === 0) {
    return text;
  }

  let content = text;
  keywordList.forEach(kw => {
    try {
      const escaped = kw.keyword.replace(/[.*+?^${}()|[\\]/g, '\\$&');
      const regex = new RegExp(`\\b(${escaped})\\b`, 'gi');
      content = content.replace(regex, match =>
        `<span class="smart-keyword" data-kw="${kw.keyword.toLowerCase()}">${match}</span>`
      );
    } catch (e) {
        console.error("Error creating regex for keyword:", kw.keyword, e);
    }
  });
  return content;
}

