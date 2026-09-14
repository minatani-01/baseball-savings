import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js']

/** 拡張子を補って実在するファイルを探す */
function withExtension(absolute) {
  if (existsSync(absolute) && path.extname(absolute)) return absolute
  for (const ext of EXTENSIONS) {
    const candidate = absolute + ext
    if (existsSync(candidate)) return candidate
  }
  for (const ext of EXTENSIONS) {
    const candidate = path.join(absolute, 'index' + ext)
    if (existsSync(candidate)) return candidate
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  // "@/types" -> <リポジトリルート>/types
  if (specifier.startsWith('@/')) {
    const resolved = withExtension(path.join(ROOT, specifier.slice(2)))
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true }
  }

  // "./html" -> "./html.ts"
  if (specifier.startsWith('.') && !path.extname(specifier)) {
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : ROOT
    const resolved = withExtension(path.resolve(path.dirname(parentPath), specifier))
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true }
  }

  return nextResolve(specifier, context)
}
