export function createPageUrl(pageName: string) {
  const [base, query] = pageName.split('?');
  const path = '/' + base;
  return query ? `${path}?${query}` : path;
}
