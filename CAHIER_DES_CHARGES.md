# Cahier des Charges Fonctionnel & Modèle Métier : Seedling Management System

---

Ce document constitue le cahier des charges officiel pour le développement de l'application de suivi horticole et d'évaluation des semis. Il définit l'architecture, la navigation, les mécanismes d'authentification, la nomenclature génétique, les formulaires de saisie terrain, le module météo avancé, la monétisation B2B et l'administration des comptes.

---

## 1. Architecture, Authentification & Profils Professionnels

* **Authentification Professionnelle (Supabase Auth)** :
  * Connexion / Inscription par **E-mail professionnel + Mot de passe fort**.
  * *Exclusion stricte des connexions tiers (ex: Google, Facebook) pour garantir la confidentialité des données d'obtention.*
  * **UX d'Authentification Intelligente** :
    * Prise en charge native de la saisie semi-automatique (`autocomplete="email"`).
    * Navigation au clavier fluide : la touche « Suivant » ou « Entrée » bascule directement le curseur sur le champ Mot de passe.
    * Bouton « Afficher / Masquer » le mot de passe.
    * Procédure de récupération sécurisée (« Mot de passe oublié ») via envoi d'un lien par e-mail.
* **Sécurité & Isolation des Données (Row Level Security - RLS)** :
  * **Catalogue Général Rosa Hybrida** : Consultation publique pour tous les utilisateurs, édition restreinte.
  * **Espace Personnel Hybrideur** : Isolation totale des données privées (croisements, lot de pollen, évaluations $Aa1$, capteurs) associées de manière stricte au `user_id` de l'utilisateur.

---

## 2. Bandeau Météo Universel & Intégration Serre (IoT)

Le bandeau météo est positionné de façon fixe tout en haut de l'application, au-dessus de la barre de navigation, pour rester visible sur l'ensemble des pages.

* **Détection Automatique (GPS / Géolocalisation)** : Récupération automatique des données météo locales en temps réel à l'ouverture.
* **Fallback Sécurisé** : Si le GPS est désactivé ou indisponible, l'application utilise automatiquement la **Ville / Code Postal** renseignée dans le profil utilisateur.
* **Indicateurs Horticoles Clés** :
  * Température (°C)
  * Taux d'humidité relative (%)
  * Indice UV
  * Couverture nuageuse / Ensoleillement
* **Connectivité Serre (Capteurs Connectés & Stations IoT)** :
  * Interface d'appairage avec des capteurs connectés en serre (hygrométrie du sol, température ambiante interne, sonde de surface).
  * Bascule possible entre la météo extérieure locale et la donnée réelle transmise par la station météo de la serre.

---

## 3. Structure de Navigation & Page d'Accueil (`/`)

* **Page d'Accueil (`/`) — Catalogue des Rosiers** :
  * Grille visuelle dynamique composée de cartes (photo HD, nom de la variété, obtenteur, type, parentage).
  * Barre de recherche instantanée (recherche par nom, obtenteur, type).
  * Barre d'outils dédiée : `+ Ajouter`, `Importer`, `Exporter`, `Tout supprimer`.
* **Menu de Navigation Supérieur** :
  1. **Accueil / Catalogue**
  2. **Croisement** (suivi des pollinisations, nouaison et fruits/cynorrhodons)
  3. **Serre / Semis** (module de saisie rapide et évaluation des individus Aa1)
  4. **Météo** (vue détaillée des conditions et de la gestion des capteurs)

---

## 4. Nomenclature & Traçabilité des Semis (Module Aa1)

L'application génère automatiquement la chaîne de traçabilité génétique selon le schéma d'héritage :

$$\text{[Parent Femelle]} \times \text{[Lot Pollen / Parent Mâle]} \rightarrow \text{[Code Fruit / Enregistrement Croisement]} (\text{ex: } Aa) \rightarrow \text{[Code Semis Unique]} (\text{ex: } Aa1-2026-001)$$

* **Lien Direct Obligatoire** : Tout semis est obligatoirement rattaché à une fiche d'enregistrement de croisement validée dans le registre.
* **Structure du Code Unique** : `[Code_Croisement]-[Année]-[Séquence]` (exemple : `Aa1-2026-001`, où `Aa1` est la référence de l'enregistrement du croisement parent).
* **Catégorisation des Collections & Semis Personnel** :
  * **Variétés Baptisées** : Variétés sélectionnées, stabilisées et officiellement nommées.
  * **Lignées d'Élevage / Souches Parentales** : Semis non commercialisés mais conservés au catalogue privé comme géniteurs précieux pour de futurs croisements.
  * **Semis sous Évaluation** : Semis en cours d'observation en serre soumis au processus de sélection/élimination.

---

## 5. Formulaires de Saisie Terrain (Cases à Cocher Contextuelles)

### 5.1. Module Pollen : Récolte, Évaluation & Congélation
* **Qualité des anthères :**
  * [ ] Abondantes et bien développées (anthères volumineuses, forte charge en pollen)
  * [ ] Rares / Malformées (développement incomplet, stérile en apparence)
* **Déhiscence & Libération :**
  * [ ] Excellente libération (pollen très poudreux, ouverture franche des loges)
  * [ ] Faible libération (pollen humide, collant ou aggloméré)
* **Mode de Conservation :**
  * [ ] Utilisation immédiate (pollen frais appliqué dans la journée)
  * [ ] Congélation à -18°C (flacon stérile avec dessiccant pour conservation longue durée)
  * [ ] Séchage préalable (déshydratation contrôlée avant congélation)

*Résultat automatisé : Génération d'un N° de Lot Pollen unique (ex: POL-2026-ROSA-01).*

### 5.2. Module Fruit (Cynorrhodon) & Diagnostic d'Avortement
* **Calibre & Maturation du Fruit :**
  * [ ] Fruit bien développé (taille conforme au type du parent femelle, coloration uniforme)
  * [ ] Fruit atrophié / Sub-normal (petit calibre, déformé ou asymétrique)
  * [ ] Maturation optimale (épicarpe tendre, virage chromatique complet)
  * [ ] Maturation précoce / Forcée (fruit mûr avant terme, risque de graines creuses)
* **Stades & Causes d'Avortement (si chute ou dessèchement) :**
  * [ ] Avortement précoce (chute du réceptacle 1 à 3 semaines après pollinisation)
  * [ ] Avortement tardif (dessèchement ou jaunissement du fruit à mi-développement)
  * [ ] Incompatibilité génétique (pollen non reconnu, absence répétée de nouaison)
  * [ ] Altération du pollen (pollen congelé altéré ou mauvaise déhiscence lors du prélèvement)
  * [ ] Stress thermique / Climatique (coup de chaleur en serre, hygrométrie basse pendant la fécondation)
  * [ ] Stress hydrique / Nutritionnel (carence ou à-coup d'arrosage pendant le grossissement)
  * [ ] Traumatisme mécanique (choc lors du nettoyage, sachet de protection trop lourd ou mal fixé)
  * [ ] Attaque sanitaire sur fleur (botrytis sur style/stigmate ou attaque de thrips)
* **Diagnostic d'Extraction (Graines / Akènes) :**
  * [ ] Fruit plein (graines bien formées, denses, endosperme ferme)
  * [ ] Fruit partiellement vide (présence d'akènes avortés ou translucides)
  * [ ] Fruit totalement vide / Graines creuses (absence complète de graines viables)

### 5.3. Module Évaluation du Semis (Aa1)

| Domaine | Critères & Cases à Cocher (Vocabulaire Professionnel) |
| :--- | :--- |
| **Phénotype & Vigueur** | [ ] Très vigoureux (pousse rapide, bois solide, entre-nœuds courts)<br>[ ] Vigueur moyenne (croissance régulière, port équilibré)<br>[ ] Chétif / Rabougri (croissance lente, tige grêle, sensibilité au stress) |
| **Pression Sanitaire** | [ ] Indemne / Tolérant (feuillage sain sans aucun signe d'attaque)<br>[ ] Oïdium / "Blanc" (feutrage blanc farineux sur jeunes pousses/boutons)<br>[ ] Marsonia / Taches noires (taches circulaires noires avec jaunissement du feuillage)<br>[ ] Mildiou du rosier (taches violacées à brunes, défoliation rapide par le bas)<br>[ ] Rouille (pustules orange à brunes sous les feuilles) |
| **Traitement & Soins** | [ ] Méthode naturelle (macération, prédateurs naturels, purins, décoctions)<br>[ ] Produit biologique (soufre, cuivre, huiles homologuées en Agriculture Biologique)<br>[ ] Produit de synthèse (fongicides ou insecticides chimiques de synthèse) |
| **Motif d'Élimination (discarded)** | [ ] Sensibilité sanitaire excessive (attaques répétées malgré traitements)<br>[ ] Défaut floral majeur (fleur malformée, pétalodie anormale, absence de floraison)<br>[ ] Port / Habitus dégradé (absence de ramification, bois cassant, végétation étouffée)<br>[ ] Stérilité constatée (absence totale de pollen viable ou d'incompatibilité) |
| **Critères de Sélection (selected)** | [ ] Aptitude au pollen (anthères bien fournies, déhiscence généreuse)<br>[ ] Remontance florale (capacité à fleurir en continu ou par vagues successives)<br>[ ] Valeur ornementale unique (coloris inédit, parfum remarquable, feuillage décoratif) |

---

## 6. Génération de Rapports Automatisés & Édition

Dès la sélection des cases à cocher sur le terrain, le système génère un texte de synthèse modifiable dans un champ libre pour permettre aux hybrideurs d'ajouter une note contextuelle.

**Exemple de Rapport Automatique Généré :**  
*« Semis Aa1-2026-001 : Sujet présentant une vigueur moyenne. Présence d'oïdium constatée sur les jeunes pousses. Traitement appliqué : produit biologique. »*

---

## 7. Architecture des Bilans, Monétisation & Services B2B

### 7.1. Bilan Mensuel d'Activité
Compilé automatiquement à partir de l'ensemble des cases cochées :
* **Taux de Nouaison Réel :** $\left(\frac{\text{Nombre de fruits récoltés}}{\text{Fleurs pollinisées}}\right) \times 100$
* **Pourcentage de vacuité :** Ratio de fruits vides par rapport au total récolté.
* **Bilan Sanitaire :** Fréquence d'apparition des pathologies (Oïdium vs Marsonia) et taux de couverture des traitements.

### 7.2. Bilan Général de Saison par Variété Parenterale (Géniteur)
Analyse annuelle consolidée pour chaque variété utilisée en parent Mâle ou Femelle :
* **Performance en Mère :** Taux de nouaison, taux de fruits vides, nombre moyen de graines viables par fruit.
* **Performance en Père (Pollen) :** Viabilité du pollen, pouvoir fécondant multi-mères, transmission des résistances/maladies.

### 7.3. Modèle d'Abonnement & Monétisation B2B
* **Offre Freemium / Découverte** : Consultation du catalogue public, gestion limitée jusqu'à 20 fiches de semis.
* **Abonnement Pro (Obtenteur / Pépinière)** :
  * Volume illimité de croisements, lots de pollen et semis $Aa1$.
  * Connectivité capteurs IoT en serre.
  * Historique météo et bilans sanitaires consolidés.
* **Émission de Dossiers Officiels DHO (Droits d'Obtention Végétale)** :
  * Exportation en un clic d'un dossier officiel au format PDF/A certifié (arbre généalogique $P_1 \times P_2$, historique horodaté des notations terrain et traçabilité sanitaire).
* **Rapports d'Index de Fertilité** :
  * Génération de bilans de compatibilité génétique et d'index de fertilité exploitables pour la cession de licences B2B auprès des éditeurs et pépiniéristes.

---

## 8. Modules d'Administration : Profil, Paramètres & Contact

### 8.1. Profil Utilisateur & Fiche Hybrideur
* **Photo de Profil / Logo** : Upload d'image avec recadrage automatique via Supabase Storage.
* **Identité Métier** : Nom d'obtenteur / Pseudo, Affixe de pépinière, numéro SIRET (optionnel pour les pros).
* **Localisation de la Station** : Adresse, Ville, Code Postal (fallback météo automatique).
* **Abonnement & Sécurité** : Statut du compte (Gratuit / Pro), accès aux factures, modification du mot de passe et 2FA.

### 8.2. Paramètres Général
* **Préférences** : Choix du thème (Botanique Épuré / Sombre / Clair), gestion des unités.
* **Seuils d'Alerte Météo** : Alertes personnalisables pour le gel (ex: $2^\circ\text{C}$) ou la surchauffe en serre (ex: $35^\circ\text{C}$).
* **Gestion des Données** : Exportation globale des données (backup CSV/JSON), options de suppression de compte (RGPD).

### 8.3. Contact & Support B2B
* **Formulaire de Support** : Routage par motif (*Support technique*, *Question Facturation*, *Licences DHO*, *Partenariat*).
* **Formulaire d'Envoi** : Saisie du message avec possibilité d'attacher une capture d'écran ou un log.
* **Centre d'Aide & FAQ** : Guides intégrés sur la nomenclature `Aa1-2026-001` et l'exportation des dossiers DHO.