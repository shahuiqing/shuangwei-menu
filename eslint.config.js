import firebaseRules from '@firebase/eslint-plugin-security-rules';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'scripts/migrations/**'] },
  { rules: { 'no-console': 'off' } },
  {
    ...firebaseRules.configs['flat/recommended'],
    rules: {
      '@firebase/security-rules/no-open-reads': 'warn',
      '@firebase/security-rules/no-open-writes': 'error',
      '@firebase/security-rules/no-redundant-matches': 'error',
    },
  },
];
