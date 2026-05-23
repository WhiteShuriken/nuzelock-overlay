# nuzelock-overlay

> **Ce code a été généré par Gemini.**

Une overlay “Nuzlocke” pour **Pokémon** (équipe, cimetière et PC Box), avec une version **Manual** basée sur un petit serveur local Node.js.

## Table des matières
- [DSMUME (classique)](#dsmume-classique)
- [Manual (installation npm)](#manual-installation-npm)

## DSMUME (classique)
Cette section décrit l’utilisation “standard” côté **dsmume / OBS**.

### Principe
- L’overlay est affichée dans **OBS** (ou dans un endroit équivalent).
- Les pages HTML sont ensuite rendues/affichées comme sources.
- Les infos (équipe, cimetière, box) peuvent être synchronisées selon votre méthode (script/extension/flux de données côté émulateur).

> Remarque : le repo local ne contient pas le code DSMUME lui-même. Les étapes exactes dépendent donc de votre intégration (scripts Lua, binding vers OBS, ou passerelle de données).

## Manual (installation npm)
Cette partie correspond à l’implémentation présente dans le dossier `Manual/`.

### 1) Prérequis
- **Node.js** (avec `npm`)

### 2) Installation
Depuis la racine du projet :
```bash
cd Manual
npm i
```

### 3) Lancer le serveur
```bash
npm start
```

Le serveur démarre sur le port **3000** et sert :
- `dashboard.html`
- `team.html`
- `cemetery.html`
- `box.html`

D’après `Manual/server.js`, les URLs sont :
- Tableau de bord : http://localhost:3000/dashboard.html
- Overlay Équipe : http://localhost:3000/team.html
- Overlay Cimetière : http://localhost:3000/cemetery.html
- Overlay Boîte PC : http://localhost:3000/box.html

### 4) Synchronisation en temps réel (Socket.IO)
- Le dashboard envoie l’état via WebSocket.
- Les overlays reçoivent la mise à jour et se rafraîchissent.

### 5) Dossier sprites
Les sprites sont servis via :
- `/sprites` → `Manual/Cemetery/CemeteryOverlaySprite/`

Le serveur charge aussi le dictionnaire depuis :
- `Manual/data pokemon - Pokemon Dico.csv`

---

![Screenshot Interface](/screen/screen dashboard.jpg)
![Screenshot OBS](screen/screen dashboard.jpg)

Si vous observez que certains sprites ne s’affichent pas, vérifiez que le nom/sans caractères spéciaux correspond bien au fichier PNG attendu (conversion en minuscule + suppression des caractères non alphanumériques).
