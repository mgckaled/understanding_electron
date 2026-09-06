// Verifica os dois jeitos de um ponteiro da documentação apodrecer:
// (1) caminho relativo cujo alvo não existe — o `guard` já cobre, mas só para
//     escrita via Edit/Write: script (python/sed) não dispara hook nenhum;
// (2) seção citada (`arquivo.md § Nome`) que não existe mais no alvo — nada
//     cobria, e 19 ponteiros apodreceram assim, a maioria pela fila de 10 marcos.
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['docs', '.claude']
const EXTRA = ['CLAUDE.md', 'README.md']

/** Collects every markdown file under the given roots, plus the loose ones. */
function collect() {
  const out = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.md')) out.push(full)
    }
  }
  for (const root of ROOTS) if (fs.existsSync(root)) walk(root)
  return out.concat(EXTRA.filter((f) => fs.existsSync(f)))
}

const LINK = /\]\((?!https?:|#|\/)([^)#\n]+)/g
// Exemplo em prosa (esquema próprio, reticências) não é ponteiro a verificar.
const NOT_A_PATH = /:\/\/|^[.…\s]*$/
const SECTION = /\]\((?!https?:)([^)#\n]+\.md)\)[^\n|]{0,3}§ *\*?([^*.,;|)\n]{4,60})/g

let broken = 0
let orphan = 0

for (const file of collect()) {
  const text = fs.readFileSync(file, 'utf8')
  const dir = path.dirname(file)

  for (const m of text.matchAll(LINK)) {
    if (NOT_A_PATH.test(m[1])) continue
    if (!fs.existsSync(path.resolve(dir, m[1]))) {
      console.log(`caminho  ${file} -> ${m[1]}`)
      broken++
    }
  }

  for (const m of text.matchAll(SECTION)) {
    const target = path.resolve(dir, m[1])
    if (!fs.existsSync(target)) continue
    // Onde a citação termina é ambíguo em prosa; as três primeiras palavras
    // identificam a seção sem precisar adivinhar o fim da frase.
    const section = m[2]
      .split(/[[(]/)[0]
      .replace(/^[*_\s]+|[*_\s]+$/g, '')
      .split(/\s+/)
      .slice(0, 3)
      .join(' ')
    if (/^\d/.test(section)) continue // "§ 2", "§ 4": numeração, não nome
    if (!fs.readFileSync(target, 'utf8').toLowerCase().includes(section.toLowerCase())) {
      console.log(`seção    ${file} -> ${m[1]} § ${section}`)
      orphan++
    }
  }
}

const total = broken + orphan
console.log(
  total === 0
    ? 'ok — nenhum caminho quebrado, nenhuma seção órfã'
    : `\n${broken} caminho(s) quebrado(s), ${orphan} seção(ões) órfã(s)`
)
process.exit(total === 0 ? 0 : 1)
