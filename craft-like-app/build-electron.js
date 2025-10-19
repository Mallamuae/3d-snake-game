// Simple script to compile electron TypeScript files to JS in dist-electron
const { execSync } = require('child_process')
const path = require('path')
const root = path.resolve(__dirname)
try {
  execSync('npx tsc -p tsconfig.json --outDir dist-electron --module commonjs', { stdio: 'inherit' })
  console.log('Electron build complete')
} catch (e) {
  console.error(e)
  process.exit(1)
}
