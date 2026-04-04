export function isMockMode(): boolean {
  return process.env.EVAL_MOCK_SEARCH === 'true';
}
