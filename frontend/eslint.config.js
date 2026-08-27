import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import {defineConfig, globalIgnores} from 'eslint/config'

export default defineConfig([
    globalIgnores(['dist', '.vite']),
    {
        files: ['**/*.{ts,tsx}'],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
            // Phải đứng CUỐI: tắt mọi rule về format để Prettier toàn quyền quyết định.
            prettier,
        ],
        languageOptions: {
            globals: globals.browser,
        },
        rules: {
            // console.error / console.warn được phép: dùng để ghi lỗi request.
            // console.log thì không — nó là dấu vết debug bỏ quên.
            'no-console': ['warn', {allow: ['error', 'warn']}],
            '@typescript-eslint/no-unused-vars': [
                'error',
                {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
            ],
        },
    },
])
