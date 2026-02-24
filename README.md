# WoWHead Copier 📋

Extension Chrome pour copier facilement les noms d'objets et leurs composants de craft depuis WoWHead.com.

## Installation

1. Ouvrir Chrome → `chrome://extensions/`
2. Activer le **Mode développeur** (en haut à droite)
3. Cliquer sur **Charger l'extension non empaquetée**
4. Sélectionner le dossier `wowhead-copier`

## Utilisation

L'extension ajoute automatiquement des boutons de copie sur les tableaux WoWHead (onglets "Reagent for", "Created by", etc.) :

**Par ligne (au survol)** :
- 📋 à côté du nom → copie le nom de l'objet
- 📋 (2e bouton) → copie le nom + tous les composants
- 📋 en fin de composants → copie uniquement la liste des composants

**En haut du tableau** :
- 📋 **Copier toute la liste** → exporte toutes les lignes d'un coup

## Noms réels via API XML

Les icônes de reagents dans WoWHead n'ont pas de texte visible. L'extension utilise l'API XML de WoWHead (`/item=ID&xml`) pour résoudre les vrais noms d'items avec accents et apostrophes. Les noms sont mis en cache pour éviter les requêtes multiples.

## Format de copie

```
Banc en argent de Dalaran
  18x Bois de Vent-froid
  4x Barre d'acier-titan
  10x Encre tombeneige
```

## Compatibilité

Fonctionne sur toutes les versions localisées de WoWHead (FR, EN, DE, ES, etc.).
