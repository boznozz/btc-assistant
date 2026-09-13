/**
 * Hardcoded fallback PDF text if live extraction fails (CORS / fetch / empty OCR).
 * Keys match BCT filenames on page.jsp?id=227 (iframe src).
 * Refresh via: python backend/extract_fallback.py path/to.pdf
 */
export const FALLBACK_PDF_TEXTS: Record<string, string> = {
  "Loi_2016_48_fr.pdf": `
LOI N° 2016-48 DU 11 JUILLET 2016, RELATIVE AUX BANQUES ET AUX ÉTABLISSEMENTS FINANCIERS

Article 1 — La présente loi a pour objet de fixer les règles relatives à l'agrément,
à l'exercice et au contrôle de l'activité des banques et des établissements financiers
ainsi que les règles relatives à la résolution des difficultés bancaires.

Article 2 — Les banques sont des personnes morales qui exercent à titre de profession
habituelle les opérations de banque. Les opérations de banque comprennent la réception
de fonds du public, les opérations de crédit, ainsi que la mise à disposition de la
clientèle et la gestion de moyens de paiement.

Article 7 — Nul ne peut exercer l'activité de banque ou d'établissement financier
sans avoir obtenu un agrément préalable délivré par le ministre chargé des finances
sur proposition de la Banque Centrale de Tunisie.

Article 8 — La demande d'agrément est adressée à la Banque Centrale de Tunisie.
Elle est accompagnée d'un dossier dont la composition est fixée par circulaire de
la Banque Centrale de Tunisie.

Article 33 — Les banques et les établissements financiers sont tenus de respecter
en permanence les normes prudentielles fixées par la Banque Centrale de Tunisie,
notamment en matière de fonds propres, de liquidité, de division des risques et
de gouvernance.

Article 46 — La Banque Centrale de Tunisie exerce le contrôle sur documents et
sur place des banques et des établissements financiers. Elle peut demander toutes
informations et tous documents nécessaires à l'exercice de sa mission.

Article 55 — En matière de change et de relations financières avec l'étranger,
les banques interviennent conformément à la réglementation des changes en vigueur
et aux instructions de la Banque Centrale de Tunisie. Les opérations de change
manuel et les transferts internationaux sont soumis aux conditions fixées par
la réglementation des changes.

Article 56 — Les banques agréées peuvent ouvrir des comptes en devises pour leurs
clients résidents et non-résidents dans les conditions fixées par la réglementation
des changes. Les mouvements sur ces comptes sont déclarés à la Banque Centrale
selon les modalités qu'elle détermine.

Article 98 — Est passible de sanctions administratives toute banque ou établissement
financier qui contrevient aux dispositions de la présente loi ou aux circulaires
de la Banque Centrale de Tunisie.
`.trim(),

  "Loi_2016_35_fr.pdf": `
LOI N° 2016-35 DU 25 AVRIL 2016, PORTANT STATUT DE LA BANQUE CENTRALE DE TUNISIE

Article 1 — La Banque Centrale de Tunisie est une personne morale de droit public.
Elle est indépendante dans la réalisation de ses missions et dans la gestion de
ses ressources.

Article 7 — L'objectif principal de la Banque Centrale de Tunisie est de veiller
à la stabilité des prix. Sans préjudice de cet objectif, elle soutient la politique
économique de l'État.

Article 8 — La Banque Centrale est chargée notamment de :
1) Définir et mettre en œuvre la politique monétaire ;
2) Contrôler la circulation monétaire et veiller à la stabilité du système financier ;
3) Contrôler les banques et les établissements financiers ;
4) Détenir et gérer les réserves de change de l'État ;
5) Veiller au bon fonctionnement des systèmes de paiement.

Article 10 — La Banque Centrale de Tunisie est l'autorité chargée de la réglementation
et du contrôle des changes. Elle édicte les circulaires relatives aux opérations de
change et aux mouvements de capitaux avec l'étranger.

Article 15 — Le Gouverneur de la Banque Centrale est nommé par décret présidentiel.
Il représente la Banque Centrale et dirige ses services.

Article 36 — La Banque Centrale publie périodiquement des rapports sur la politique
monétaire, la stabilité financière et la situation économique.
`.trim(),
};
