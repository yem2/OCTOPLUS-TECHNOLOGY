# OCTOPLUS : messagerie unifiée WhatsApp + SMS

Cette mise à jour est cumulative : elle contient aussi l'option WhatsApp officiel (API Cloud de Meta).

## Nouveautés
- Onglet **Communication > Canaux** (super administrateur) : état de WhatsApp, SMS et e-mail, et message groupé avec choix « Automatique : WhatsApp puis SMS ».
- **SMS via un téléphone Android** (carte SIM) avec l'application gratuite « SMS Gateway for Android » : aucun contrat d'opérateur, aucun serveur à héberger.
- **Bascule automatique** : si l'envoi WhatsApp / Telegram échoue, un SMS part (désactivable avec `SMS_FALLBACK=0`), puis l'e-mail en dernier recours.

## Activer les SMS en 10 minutes (téléphone Android)
1. Sur un téléphone Android avec une carte SIM (et du crédit SMS), installez « SMS Gateway for Android » (page des versions du projet capcom6/android-sms-gateway sur GitHub).
2. Dans l'application : autorisez l'envoi de SMS, activez **Cloud Server**, appuyez sur **Online**, puis notez l'identifiant et le mot de passe affichés.
3. Dans Vercel (Settings > Environment Variables, Production) : `SMS_PROVIDER` = `smsgate`, `SMS_GATE_USER` = identifiant, `SMS_GATE_PASSWORD` = mot de passe (type Sensitive). Redéployez.
4. OCTOPLUS > Communication > SMS : envoyez un SMS de test.
Le téléphone doit rester allumé, connecté à Internet, avec l'application ouverte ou en arrière-plan autorisé.

## WhatsApp
- Recommandé : API officielle de Meta (onglet WhatsApp, étapes affichées).
- Baileys (passerelle) : à garder seulement si vous avez un serveur toujours allumé.
