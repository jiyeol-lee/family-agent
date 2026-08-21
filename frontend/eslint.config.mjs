import eslint from '@eslint/js';
import angular from 'angular-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'explicit', overrides: { constructors: 'off' } },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'class',
          format: ['PascalCase'],
          custom: { regex: '^T[A-Z]', match: false },
        },
        {
          selector: ['interface', 'typeAlias'],
          format: ['PascalCase'],
          prefix: ['T'],
        },
        {
          selector: 'memberLike',
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'require',
        },
        {
          selector: 'parameterProperty',
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'require',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "PropertyDefinition[accessibility='protected']",
          message: 'Use public or private class members.',
        },
        {
          selector: "MethodDefinition[accessibility='protected']",
          message: 'Use public or private class members.',
        },
        {
          selector: "TSParameterProperty[accessibility='protected']",
          message: 'Use public or private class members.',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
  },
  eslintConfigPrettier,
);
