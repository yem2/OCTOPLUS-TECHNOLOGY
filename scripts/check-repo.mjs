// Garde-fou avant chaque mise en ligne : détecte les fichiers en double (ex. « auth (1).ts »), les secrets suivis par Git et les .env.
import { execSync } from 'node:child_process'
const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
const problems = []
for (const f of files) {
  if (/ \(\d+\)(\.[\w]+)?$/.test(f) || /\s-\s*copie|copy of /i.test(f)) problems.push(`Fichier en double probable : ${f} (supprimez-le)`)
  if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.example')) problems.push(`Fichier d'environnement suivi par Git : ${f} (il contiendrait des secrets)`)
  if (/\.(pem|key)$/.test(f)) problems.push(`Clé privée suivie par Git : ${f}`)
}
if (problems.length) { console.error('\n' + problems.map((p) => `✗ ${p}`).join('\n') + '\n'); process.exit(1) }
console.log(`✓ Dépôt propre (${files.length} fichiers suivis)`)
