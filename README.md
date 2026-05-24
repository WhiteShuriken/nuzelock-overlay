✨ **Une overlay « Nuzlocke » dynamique pour vos streams Pokémon (Équipe, Cimetière et Boîtes PC).**

> 🤖 *Ce code a été généré avec l'aide de Gemini.*

L'application propose deux approches : une intégration classique via émulateur (**DeSmuME**) et une version autonome (**Manual**) propulsée par un serveur local Node.js et synchronisée en temps réel.

---

## 📊 Badges & Statut

![Générations](https://img.shields.io/badge/G%C3%A9n%C3%A9rations-1_à_5_uniquement-blue?style=for-the-badge&logo=pokemon)
![Sprites Source](https://img.shields.io/badge/Sprites-Pok%C3%A9mon_Showdown_(2D_Anim%C3%A9)-critical?style=for-the-badge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

---

## 📝 Table des matières

- [🎨 Compatibilité & Moteur de Sprites](#-compatibilite--moteur-de-sprites)
- [🎮 Mode DeSmuME (Classique)](#-mode-desmume-classique)
- [💻 Mode Manual (Installation Node.js)](#-mode-manual-installation-nodejs)
- [📸 Aperçus & Captures d'écran](#-apercus--captures-decran)
- [⚖️ Crédits & Copyright](#%EF%B8%8F-credits--copyright--pokemon-sprites)
- [📄 Licence](#-licence)

---

## 🎨 Compatibilité & Moteur de Sprites

Ce projet a été conçu avec une orientation rétro-gaming et une esthétique pixel-art. La logique interne, le dictionnaire de traduction ainsi que l'affichage visuel respectent les spécifications suivantes :

### 📌 Spécifications techniques
* **Limite de Générations :** Prise en charge exclusive des Pokémon de la **Génération 1 à la Génération 5** (de la région de Kanto jusqu'à Unys inclus). Les Pokémon apparus en 6G et supérieur (*X/Y, Épée/Bouclier, Écarlate/Violet*, etc.) ne sont pas reconnus.
* **Moteur de Sprites :** L'application appelle dynamiquement les répertoires de **Pokémon Showdown** pour afficher les sprites au format **2D Animé style 5G** (`.gif`).
* **Support des Shinies :** Gestion native des variantes chromatiques (Shiny) via les banques d'images `gen5ani-shiny`.
* **Système de Secours (Fallback) :** Si un sprite animé est introuvable ou rencontre un problème de chargement, l'interface bascule automatiquement sur une icône fixe propre en haute définition (via *Pokémon Database*).

> 💡 **Conseil d'utilisation :**
> Si vous constatez des bugs d'affichage ou des images figées de générations récentes après une mise à jour, utilisez le bouton **« ⚠️ Tout réinitialiser »** sur le panneau de contrôle ou videz le stockage local de votre navigateur (`localStorage.clear();`) pour purger les anciennes données mises en cache.

---

## 🎮 Mode DeSmuME (Classique)

Cette section décrit l’utilisation « standard » côté **émulateur / OBS**.

### Principe de fonctionnement
* L’overlay est affichée directement dans **OBS** (ou votre logiciel de stream) en tant que source navigateur.
* Les infos (équipe, cimetière, boîtes) peuvent être synchronisées selon votre propre méthode (script Lua tiers, extension ou flux de données côté émulateur).

> ⚠️ **Remarque :** Ce dépôt local ne contient pas le code de liaison DeSmuME lui-même. Les étapes exactes dépendent de votre intégration technique personnelle (scripts Lua, liaison vers OBS ou passerelle de données dédiée).

---

## 💻 Mode Manual (Installation Node.js)

Cette partie correspond à l’implémentation autonome présente dans le dossier `Manual/`, qui vous permet de tout gérer à la main depuis un panneau de contrôle (Dashboard).

### 1) Prérequis
Pour faire tourner l'ensemble du projet, vous aurez besoin de :
* **Node.js** (avec `npm`) pour exécuter le serveur local.
* **Python 3** pour les scripts de traitement ou d'extraction de données.

### 2) Installation
Ouvrez votre terminal, déplacez-vous à la racine du projet et exécutez les commandes suivantes :
```bash
cd Manual
npm install
```

### 3) Lancement du serveur
```bash
npm start
```

Le serveur démarre par défaut sur le port **3000** et distribue les accès suivants :

| Interface | URL Locale | Usages |
| :--- | :--- | :--- |
| **Tableau de bord** | http://localhost:3000/dashboard.html | Panneau de contrôle (Gestion de l'équipe / PC) |
| **Overlay Équipe** | http://localhost:3000/team.html | À intégrer sur OBS (Équipe active) |
| **Overlay Cimetière** | http://localhost:3000/cemetery.html | À intégrer sur OBS (Défilé des Pokémon K.O.) |
| **Overlay Boîte PC** | http://localhost:3000/box.html | À intégrer sur OBS (Vue sur le PC) |

### 4) Synchronisation en temps réel (Socket.IO)
* Le **Dashboard** envoie instantanément les modifications d'état via WebSockets dès que vous déplacez un Pokémon.
* Les **Overlays** reçoivent la mise à jour en temps réel et se rafraîchissent de manière fluide sans recharger la page.

### 5) Gestion des ressources locales
* **Dossier de sprites locaux :** Servis via la route `/sprites` ➔ reliée à `Manual/Cemetery/CemeteryOverlaySprite/`.
* **Dictionnaire :** Le serveur charge la base de données de traduction depuis le fichier `Manual/data pokemon - Pokemon Dico.csv`.

---

## 📸 Aperçus & Captures d'écran

Voici un aperçu de l'interface d'administration et du rendu final sous OBS :

### Le Panneau de Contrôle (Dashboard)
![Screenshot Interface](screen/screen%20dashboard.jpg)

### Rendu final configuré sur OBS
![Screenshot OBS](screen/screen%20obs.png)

> 🔧 **Dépannage des sprites :** Si certains sprites locaux ne s’affichent pas, vérifiez que leur nom de fichier ne contient aucun caractère spécial (lettres accentuées, espaces). Le script applique une conversion en minuscules et supprime tous les caractères non alphanumériques.

---

## ⚖️ Crédits & Copyright — Pokémon Sprites

Ce projet utilise des sprites et des visuels issus de la franchise de jeux vidéo **Pokémon**.

### ⚠️ Mentions Légales & Droits d'Auteur
> [!IMPORTANT]
> **Tous les droits sur ces visuels et personnages appartiennent exclusivement à leurs propriétaires respectifs.**
> * **Propriété intellectuelle :** &amp;copy; The Pokémon Company / Nintendo / Creatures Inc. / GAME FREAK.
> * **Source des ressources :** Jeux vidéo officiels de la franchise *Pokémon* et extraits de la plateforme communautaire *Pokémon Showdown*.

### ℹ️ Clause de Non-Responsabilité (Disclaimer)
* **But non lucratif :** Ce projet est une initiative de fan, strictement **gratuite et non commerciale**.
* **Usage loyal (Fair Use) :** L'utilisation de ces sprites est faite à but purement illustratif, décoratif et communautaire pour le streaming de défis (Nuzlocke). Aucune violation de copyright n'est intentionnelle.
* **Affiliation :** Ce projet n'est en aucun cas affilié, approuvé ou soutenu par *The Pokémon Company*, *Nintendo* ou leurs studios partenaires.

### 📬 Contact & Retrait des visuels
Si vous êtes un représentant légal des ayants droit et que vous souhaitez le retrait de ces fichiers de ce dépôt, merci d'ouvrir une *Issue* ou de me contacter directement.

---

## 📄 Licence

Ce projet est distribué sous licence **MIT**. Consultez le fichier `LICENSE` pour plus de détails.