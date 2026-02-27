import config from '../../packages/config/eslint.config.js'

export default [
  { ignores: ['.astro/**'] },
  ...config,
]
