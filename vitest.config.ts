import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: [
      './tests/setupVitest.ts'
    ]
  }
})
