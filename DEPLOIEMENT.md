# Mettre en ligne sans rien casser

Règle d'or : **tout passe par GitHub**. Vercel déploie automatiquement ce qui est sur la branche `master`.

## Mise à jour normale (recommandée)
1. Crée une branche : `git checkout -b ma-modification`
2. Fais tes changements, puis : `pnpm check` (types + dépôt propre)
3. `git add -A && git commit -m "Description" && git push -u origin ma-modification`
4. Sur GitHub, ouvre une **Pull request** : la vérification automatique se lance et Vercel crée une adresse de **prévisualisation** à tester.
5. Si tout va bien : **Merge** → la production se met à jour toute seule.

## Mise à jour rapide (petit changement)
Dépose les fichiers directement sur `master` (Add file → Upload files), puis vérifie que le déploiement du haut, sur Vercel, est **Production** et **Ready**.

## À ne JAMAIS faire
- Cliquer sur **Redeploy** sur un ancien déploiement : l'ancien code repasse en production.
- Déposer des fichiers nommés `quelquechose (1).ts` : ce sont des doublons qui font échouer le build (la vérification les détecte).
- Mettre un fichier `.env` sur GitHub : les secrets se règlent uniquement dans Vercel → Settings → Environment Variables.

## Revenir en arrière
Vercel → Deployments → choisis le dernier déploiement qui fonctionnait → menu « ⋯ » → **Promote to Production**.
Quand tu as corrigé, refais une mise à jour normale : le site repart sur la dernière version de GitHub.

## Savoir quelle version est en ligne
En bas du menu de gauche, « Version abc1234 » est le début du commit déployé : il doit correspondre au dernier commit de GitHub.
