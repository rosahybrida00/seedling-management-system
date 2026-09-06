# **Cahier des Charges Fonctionnel & Modèle Metier : Seedling Management System**

---

Ce document constitue le cahier des charges officiel pour le développement du module de suivi horticole et d'évaluation des semis. Il définit la nomenclature, les formulaires de saisie guidée par cases à cocher contextuelles, les automatisations de traçabilité ainsi que la structure des bilans périodiques et annuels.

## **1\. Introduction & Objectifs de Traçabilité**

---

Le système vise une traçabilité intégrale sans faillite, depuis la récolte du pollen jusqu'à l'homologation des variétés sélectionnées. L'objectif principal est de remplacer toute saisie textuelle libre non structurée par un système hybride :

* **Saisie 100 % normée par cases à cocher** enrichies d'explications techniques entre parenthèses.  
* **Génération automatique de rapports éditables** pour faciliter le travail des hybrideurs en serre.  
* **Agrégation des données** pour la constitution de bilans mensuels et de fiches de valeur pour la monétisation B2B.

## **2\. Nomenclature & Règle d'Identifiants Automatisés**

---

L'application génère automatiquement la chaîne de traçabilité génétique selon le schéma d'héritage :

**Schéma de Génération :**

\[Parent Femelle\] × \[Lot Pollen / Parent Mâle\] → \[Code Fruit / Cynorrhodon\] (ex: Aa) → \[Code Semis Unique\] (ex: Aa1)

Chaque semis conserve son matricule historique (**Aa1**, **Aa2**, etc.) qui lui sert de clé primaire métier à travers toutes ses étapes d'évolution.

## **3\. Formulaires de Saisie Terrain (Cases à Cocher Contextuelles)**

### ---

**3.1. Module Pollen : Récolte, Évaluation & Congélation**

Utilisation lors du prélèvement des anthères sur le parent mâle.

* **Qualité des anthères :**  
  * \[ \] Abondantes et bien développées (anthères volumineuses, forte charge en pollen)  
  * \[ \] Rares / Malformées (développement incomplet, stérile en apparence)  
* **Déhiscence & Libération :**  
  * \[ \] Excellente libération (pollen très poudreux, ouverture franche des loges)  
  * \[ \] Faible libération (pollen humide, collant ou aggloméré)  
* **Mode de Conservation :**  
  * \[ \] Utilisation immédiate (pollen frais appliqué dans la journée)  
  * \[ \] Congélation à \-18°C (flacon stérile avec dessiccant pour conservation longue durée)  
  * \[ \] Séchage préalable (déshydratation contrôlée avant congélation)

*Résultat automatisé : Génération d'un N° de Lot Pollen unique (ex: POL-2026-ROSA-01).*

### **3.2. Module Fruit (Cynorrhodon) & Diagnostic d'Avortement**

Évaluation à la récolte ou lors de la perte d'un croisement.

* **Calibre & Maturation du Fruit :**  
  * \[ \] Fruit bien développé (taille conforme au type du parent femelle, coloration uniforme)  
  * \[ \] Fruit atrophié / Sub-normal (petit calibre, déformé ou asymétrique)  
  * \[ \] Maturation optimale (épicarpe tendre, virage chromatique complet)  
  * \[ \] Maturation précoce / Forcée (fruit mûr avant terme, risque de graines creuses)  
* **Stades & Causes d'Avortement (si chute ou dessèchement) :**  
  * \[ \] Avortement précoce (chute du réceptacle 1 à 3 semaines après pollinisation)  
  * \[ \] Avortement tardif (dessèchement ou jaunissement du fruit à mi-développement)  
  * \[ \] Incompatibilité génétique (pollen non reconnu, absence répétée de nouaison)  
  * \[ \] Altération du pollen (pollen congelé altéré ou mauvaise déhiscence lors du prélèvement)  
  * \[ \] Stress thermique / Climatique (coup de chaleur en serre, hygrométrie basse pendant la fécondation)  
  * \[ \] Stress hydrique / Nutritionnel (carence ou à-coup d'arrosage pendant le grossissement)  
  * \[ \] Traumatisme mécanique (choc lors du nettoyage, sachet de protection trop lourd ou mal fixé)  
  * \[ \] Attaque sanitaire sur fleur (botrytis sur style/stigmate ou attaque de thrips)  
* **Diagnostic d'Extraction (Graines / Akènes) :**  
  * \[ \] Fruit plein (graines bien formées, denses, endosperme ferme)  
  * \[ \] Fruit partiellement vide (présence d'akènes avortés ou translucides)  
  * \[ \] Fruit totalement vide / Graines creuses (absence complète de graines viables)  
  * *Causes de vacuité :* Incompatibilité gamétophytique, pollen stérile, anomalie ovulaire femelle, choc thermique à la nouaison.

### **3.3. Module Évaluation du Semis (Aa1)**

Grille de notation utilisée lors des visites d'observation des jeunes plants.

| Domaine | Critères & Cases à Cocher (Vocabulaire Professionnel)   |
| :---- | :---- |
| **Phénotype & Vigueur** | \[ \] Très vigoureux (pousse rapide, bois solide, entre-nœuds courts) \[ \] Vigueur moyenne (croissance régulière, port équilibré) \[ \] Chétif / Rabougri (croissance lente, tige grêle, sensibilité au stress) |
| **Pression Sanitaire** | \[ \] Indemne / Tolérant (feuillage sain sans aucun signe d'attaque) \[ \] Oïdium / "Blanc" (feutrage blanc farineux sur jeunes pousses/boutons) \[ \] Marsonia / Taches noires (taches circulaires noires avec jaunissement du feuillage) \[ \] Mildiou du rosier (taches violacées à brunes, défoliation rapide par le bas) \[ \] Rouille (pustules orange à brunes sous les feuilles) |
| **Traitement & Soins** | \[ \] Méthode naturelle (macération, prédateurs naturels, purins, décoctions) \[ \] Produit biologique (soufre, cuivre, huiles homologuées en Agriculture Biologique) \[ \] Produit de synthèse (fongicides ou insecticides chimiques de synthèse) |
| **Motif d'Élimination (discarded)** | \[ \] Sensibilité sanitaire excessive (attaques répétées malgré traitements) \[ \] Défaut floral majeur (fleur malformée, pétalodie anormale, absence de floraison) \[ \] Port / Habitus dégradé (absence de ramification, bois cassant, végétation étouffée) \[ \] Stérilité constatée (absence totale de pollen viable ou d'incompatibilité) |
| **Critères de Sélection (selected)** | \[ \] Aptitude au pollen (anthères bien fournies, déhiscence généreuse) \[ \] Remontance florale (capacité à fleurir en continu ou par vagues successives) \[ \] Valeur ornementale unique (coloris inédit, parfum remarquable, feuillage décoratif) |

## **4\. Génération de Rapports Automatises & Édition**

---

Dès la sélection des cases à cocher sur le terrain, le système génère un texte de synthèse modifiable dans un champ libre pour permettre aux hybrideurs d'ajouter une note contextuelle sans imposer la frappe lourde.

**Exemple de Rapport Automatique Généré :**  
*« Semis Aa1 : Sujet présentant une vigueur moyenne. Présence d'oïdium constatée sur les jeunes pousses. Traitement appliqué : produit biologique. »*

(Champ texte entièrement éditable par l'utilisateur avant validation finale).

## **5\. Architecture des Bilans & Modèle de Valorisation**

### ---

**5.1. Bilan Mensuel d'Activité**

Compilé automatiquement le 30 de chaque mois à partir de l'ensemble des cases cochées :

* **Taux de Nouaison Réel :** (Nombre de fruits récoltés / Fleurs pollinisées) × 100\.  
* **Pourcentage de vacuité :** Ratio de fruits vides par rapport au total récolté.  
* **Bilan Sanitaire :** Fréquence d'apparition des pathologies (Oïdium vs Marsonia) et taux de couverture des traitements biologiques vs de synthèse.

### **5.2. Bilan Général de Saison par Variété Parenterale (Géniteur)**

Analyse annuelle consolidée pour chaque variété utilisée en parent Mâle ou Femelle :

* **Performance en Mère :** Taux de nouaison, taux de fruits vides, nombre moyen de graines viables par fruit, taux de germination des descendants.  
* **Performance en Père (Pollen) :** Viabilité du pollen (frais vs congelé), pouvoir fécondant multi-mères, transmission des résistances/maladies.

### **5.3. Valorisation B2B & Monétisation**

* **Dossiers DHO (Droits d'Obtention Végétale) :** Exportation directe des fiches de sélection avec historique complet du semis Aa1 et généalogie certifiée.  
* **Rapports de Performance Génétique :** Vente de bilans de compatibilité génétique et d'index de fertilité aux pépiniéristes et obtenteurs partenaires.