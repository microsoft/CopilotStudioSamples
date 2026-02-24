import { build, context } from 'esbuild'

const isWatch = process.argv.includes('--watch')

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'CopilotChat',
  outfile: 'dist/copilot-chat.js',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  minify: !isWatch,
  conditions: ['browser', 'import'],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  footer: {
    js: 'if(typeof window!=="undefined")window.CopilotChat=CopilotChat;',
  },
}

if (isWatch) {
  const ctx = await context(options)
  await ctx.watch()
  console.log('Watching for changes...')
} else {
  const result = await build(options)
  const fs = await import('fs')
  const stat = fs.statSync('dist/copilot-chat.js')
  console.log(`Build complete: dist/copilot-chat.js (${(stat.size / 1024).toFixed(1)} KB)`)
}
