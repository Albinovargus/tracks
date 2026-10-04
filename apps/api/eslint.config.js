import baseConfig from '@tracks/config/eslint.config.base';

export default [
  ...baseConfig,
  {
    ignores: ['dist/'],
  },
];
