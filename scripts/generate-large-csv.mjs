import { createWriteStream } from 'node:fs'

const [, , outputPath, rowCountArg] = process.argv
const rowCount = Number(rowCountArg ?? 5_000_000)

if (!outputPath) {
  console.error('usage: node scripts/generate-large-csv.mjs <output-path> [row-count]')
  process.exit(1)
}

const stream = createWriteStream(outputPath)
stream.write('id,name,email,city,signup_date,score\n')

const cities = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Recife']

for (let i = 0; i < rowCount; i++) {
  const city = cities[i % cities.length]
  const line = `${i},"User ${i}",user${i}@example.com,${city},2024-01-${String((i % 28) + 1).padStart(2, '0')},${(i % 100) / 10}\n`
  if (!stream.write(line)) {
    await new Promise((resolve) => stream.once('drain', resolve))
  }
}

stream.end()
await new Promise((resolve) => stream.once('close', resolve))
console.log(`wrote ${rowCount} rows to ${outputPath}`)
