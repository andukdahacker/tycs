import config from '../../packages/config/eslint.config.js'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  ...config,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
]
