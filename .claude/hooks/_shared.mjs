/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Shared helpers for the Claude Code hooks.
 *
 * The one non-obvious piece here is `resolveBin`. Spawning `pnpm` or a
 * `node_modules/.bin` shim on Windows requires `shell: true`, because Node
 * does not apply PATHEXT on its own — and once a shell is involved, every
 * argument containing a space becomes a quoting problem.
 *
 * Instead we read the dependency's own `package.json`, follow its `bin`
 * field to a plain JavaScript entry point, and run it with the Node binary
 * that is already executing this hook. No shell, no PATH lookup, no quoting,
 * identical behaviour on every platform.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

/** Reads the tool-call JSON that Claude Code writes to stdin. */
export async function readHookInput() {
  try {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  }
}

/** Absolute path of the edited file, or null when there isn't one. */
export function editedFile(input) {
  const raw = input?.tool_input?.file_path
  return typeof raw === 'string' && raw.length > 0 ? path.resolve(raw) : null
}

/** Shell command of a Bash/PowerShell tool call, or null when there isn't one. */
export function toolCommand(input) {
  const raw = input?.tool_input?.command
  return typeof raw === 'string' && raw.length > 0 ? raw : null
}

/** Repo-relative POSIX path, or null when the file lives outside the repo. */
export function repoRelative(absPath) {
  const rel = path.relative(REPO_ROOT, absPath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  return rel.split(path.sep).join('/')
}

/** True when the package directory exists — symlink, junction or real. */
function isInstalled(pkg) {
  try {
    lstatSync(path.join(REPO_ROOT, 'node_modules', pkg))
    return true
  } catch {
    return false
  }
}

/**
 * Locates a dependency's package.json.
 *
 * Two strategies, because pnpm links every top-level package to a directory
 * under `node_modules/.pnpm` — a junction on Windows. The direct path works
 * whenever that link resolves; Node's own resolver is the fallback for the
 * layouts where it does not.
 */
function findManifest(pkg) {
  const direct = path.join(REPO_ROOT, 'node_modules', pkg, 'package.json')
  if (existsSync(direct)) return direct

  const require = createRequire(path.join(REPO_ROOT, 'package.json'))
  try {
    return require.resolve(`${pkg}/package.json`)
  } catch {
    // Packages whose `exports` map hides their own manifest: start from the
    // main entry point and walk up until a package.json appears.
    try {
      let dir = path.dirname(require.resolve(pkg))
      for (let depth = 0; depth < 6; depth += 1) {
        const candidate = path.join(dir, 'package.json')
        if (existsSync(candidate)) return candidate
        const parent = path.dirname(dir)
        if (parent === dir) break
        dir = parent
      }
    } catch {
      /* not resolvable */
    }
    return null
  }
}

/** Path to a dependency's executable entry point, or null when not installed. */
export function resolveBin(pkg, binName = pkg) {
  const manifest = findManifest(pkg)
  if (!manifest) return null
  try {
    const { bin } = JSON.parse(readFileSync(manifest, 'utf8'))
    const entry = typeof bin === 'string' ? bin : bin?.[binName]
    if (!entry) return null
    const resolved = path.join(path.dirname(manifest), entry)
    return existsSync(resolved) ? resolved : null
  } catch {
    return null
  }
}

/**
 * Runs a dependency's CLI under the current Node binary. Never throws.
 *
 * Returns null when the tool is absent, and the caller must treat that as
 * "skip, do not block". The one case that gets a warning is a package that
 * *is* installed but whose executable could not be resolved: staying quiet
 * there would leave the hook permanently inert while looking perfectly
 * healthy, which is worse than a noisy line on stderr.
 */
export function runBin(pkg, args, { binName, timeout = 30_000 } = {}) {
  const bin = resolveBin(pkg, binName ?? pkg)
  if (!bin) {
    if (isInstalled(pkg)) {
      console.error(
        `[hook] ${pkg} está em node_modules mas seu executável não pôde ser resolvido — ` +
          'este hook está inativo. Verifique a instalação (pnpm install).'
      )
    }
    return null
  }
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout,
    windowsHide: true
  })
  if (result.error) return null
  return result
}

/** Strips block comments; strips line comments only where that syntax exists. */
export function stripComments(source, { lineComments = true } = {}) {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, '')
  return lineComments ? withoutBlocks.replace(/^\s*\/\/.*$/gm, '') : withoutBlocks
}
