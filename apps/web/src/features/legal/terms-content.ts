/**
 * Terms & Conditions content — English and Spanish full text.
 *
 * Deliberately NOT routed through the i18n translation keys the rest of the
 * app uses: `TranslationShape` (locales/en.ts) requires every leaf to be a
 * string, and this is closer to bilingual *data* than UI microcopy — there's
 * no interpolation or pluralization here, just two parallel documents picked
 * by `i18n.language`, the same way `formatPartialDate` picks its output by
 * locale rather than through a translation key.
 *
 * Operator details (name, contact, jurisdiction) are filled in from the ones
 * provided directly by the app's owner — this document has not otherwise
 * been reviewed by a lawyer, which is worth keeping in mind before treating
 * it as more than a reasonable starting point.
 */

export interface TermsSection {
  id: string;
  title: string;
  /** One entry per paragraph. An entry starting with "• " renders as a bullet. */
  paragraphs: string[];
}

export interface TermsDocument {
  metaTitle: string;
  intro: string;
  sections: TermsSection[];
  lastUpdatedLabel: string;
  /** DD/MM/YYYY, matching the app's own date convention. */
  effectiveDate: string;
}

const OPERATOR = {
  en: { name: 'Franco Pignanelli (dev)', email: 'francopignanelli18@gmail.com', jurisdiction: 'Argentina (Buenos Aires)' },
  es: { name: 'Franco Pignanelli (dev)', email: 'francopignanelli18@gmail.com', jurisdiction: 'Argentina (Buenos Aires)' },
} as const;

const EFFECTIVE_DATE = '21/08/2026';

const en: TermsDocument = {
  metaTitle: 'Terms and Conditions',
  intro:
    'These Terms and Conditions ("Terms") govern access to and use of Timelines (the "Service"), a canvas-based application for organizing personal, collaborative, and public history through timelines, milestones, and stages. By creating an account or otherwise using the Service, you agree to these Terms.',
  lastUpdatedLabel: 'Last updated',
  effectiveDate: EFFECTIVE_DATE,
  sections: [
    {
      id: 'service',
      title: '1. The Service',
      paragraphs: [
        'The Service lets you create Timelines (a visual organization layer), Milestones (points in time), and Stages (periods of time), and to share them privately, with invited collaborators, or — if you choose — publicly via a link. Timelines are private by default.',
        'The Service is provided on an "as is" and "as available" basis. Features, limits, and pricing may change, and we may add, modify, or discontinue parts of the Service at any time.',
      ],
    },
    {
      id: 'accounts',
      title: '2. Accounts',
      paragraphs: [
        'You must provide accurate information when creating an account and keep your login credentials confidential. You are responsible for all activity that occurs under your account.',
        'You must be legally capable of entering into a binding contract in your jurisdiction to use the Service. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization to these Terms.',
      ],
    },
    {
      id: 'content',
      title: '3. Your Content',
      paragraphs: [
        'You retain ownership of the text, images, files, and other material you upload or create within the Service ("Your Content"). You grant us a limited, non-exclusive license to store, process, and display Your Content solely for the purpose of operating and providing the Service to you and to those you explicitly share it with.',
        'You are solely responsible for Your Content and for having the rights necessary to upload and share it. You must not upload material that infringes someone else’s intellectual property, violates their privacy, or that you do not have the right to share.',
        'Uploads are subject to file-type and size limits enforced by the Service; these limits exist to keep the Service usable and affordable for everyone and may change over time.',
      ],
    },
    {
      id: 'acceptable-use',
      title: '4. Acceptable Use',
      paragraphs: [
        'You agree not to:',
        '• Use the Service for any unlawful purpose, or to store or share content that is illegal, defamatory, or infringing.',
        '• Attempt to bypass access controls, probe or scan the Service for vulnerabilities, or access another user’s private content without authorization.',
        '• Use automated means to create accounts, scrape data, or place excessive load on the Service (for example, uploading files with the intent of using the Service as free file storage rather than for its intended purpose).',
        '• Upload malware or any content designed to disrupt or damage the Service or other users.',
        'We may suspend or terminate access for conduct that violates this section, with or without notice, at our discretion.',
      ],
    },
    {
      id: 'sharing',
      title: '5. Sharing and Public Content',
      paragraphs: [
        'If you set a Timeline to Shared, Unlisted, or Public, you are choosing to make its content — and anything it references — visible to the corresponding audience. You are responsible for understanding what becomes visible before changing a Timeline’s visibility.',
        'Anyone you invite as a collaborator may be able to view or edit content according to the role you grant them. We are not responsible for what an invited collaborator does with access you granted them.',
      ],
    },
    {
      id: 'moderation',
      title: '6. Moderation and Removal',
      paragraphs: [
        'We may remove content or suspend accounts that we believe, in good faith, violate these Terms or applicable law, or that we are required to act on by legal process. We will generally attempt to notify you, but are not always able to do so in advance.',
      ],
    },
    {
      id: 'privacy',
      title: '7. Privacy',
      paragraphs: [
        'Timelines are private by default and become visible to others only through your own explicit sharing choices. Uploaded files are stored privately and served only through short-lived, authorization-checked links — never a public, permanent URL.',
        'A separate Privacy Policy, once published, will describe in more detail what data is collected and how it is used; these Terms govern your use of the Service generally.',
      ],
    },
    {
      id: 'termination',
      title: '8. Termination',
      paragraphs: [
        'You may stop using the Service and request deletion of your account at any time. We may suspend or terminate your access if you violate these Terms, or discontinue the Service in whole or in part with reasonable notice where practical.',
      ],
    },
    {
      id: 'disclaimers',
      title: '9. Disclaimers',
      paragraphs: [
        'The Service is provided without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement, to the maximum extent permitted by applicable law.',
      ],
    },
    {
      id: 'liability',
      title: '10. Limitation of Liability',
      paragraphs: [
        'To the maximum extent permitted by law, the Service’s operator will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data, arising from your use of the Service.',
      ],
    },
    {
      id: 'changes',
      title: '11. Changes to These Terms',
      paragraphs: [
        'We may update these Terms from time to time. Material changes will be indicated by an updated "Last updated" date on this page. Continuing to use the Service after changes take effect constitutes acceptance of the revised Terms.',
      ],
    },
    {
      id: 'law',
      title: '12. Governing Law',
      paragraphs: [
        `These Terms are governed by the laws of ${OPERATOR.en.jurisdiction}, without regard to its conflict-of-laws principles.`,
      ],
    },
    {
      id: 'contact',
      title: '13. Contact',
      paragraphs: [
        `Questions about these Terms can be sent to ${OPERATOR.en.email}. The Service is operated by ${OPERATOR.en.name}.`,
      ],
    },
  ],
};

const es: TermsDocument = {
  metaTitle: 'Términos y Condiciones',
  intro:
    'Estos Términos y Condiciones ("Términos") rigen el acceso y uso de Timelines (el "Servicio"), una aplicación tipo lienzo para organizar historia personal, colaborativa y pública mediante líneas de tiempo, hitos y etapas. Al crear una cuenta o usar el Servicio de cualquier forma, aceptás estos Términos.',
  lastUpdatedLabel: 'Última actualización',
  effectiveDate: EFFECTIVE_DATE,
  sections: [
    {
      id: 'service',
      title: '1. El Servicio',
      paragraphs: [
        'El Servicio te permite crear Líneas de tiempo (una capa visual de organización), Hitos (puntos en el tiempo) y Etapas (períodos de tiempo), y compartirlos de forma privada, con colaboradores invitados o, si lo elegís, públicamente mediante un enlace. Las líneas de tiempo son privadas por defecto.',
        'El Servicio se provee "tal cual" y "según disponibilidad". Las funciones, límites y precios pueden cambiar, y podemos agregar, modificar o discontinuar partes del Servicio en cualquier momento.',
      ],
    },
    {
      id: 'accounts',
      title: '2. Cuentas',
      paragraphs: [
        'Debés proporcionar información precisa al crear una cuenta y mantener tus credenciales de acceso en confidencialidad. Sos responsable de toda actividad que ocurra bajo tu cuenta.',
        'Debés tener capacidad legal para celebrar un contrato vinculante en tu jurisdicción para usar el Servicio. Si usás el Servicio en representación de una organización, declarás tener autoridad para vincularla a estos Términos.',
      ],
    },
    {
      id: 'content',
      title: '3. Tu contenido',
      paragraphs: [
        'Conservás la propiedad del texto, imágenes, archivos y demás material que subas o crees dentro del Servicio ("tu contenido"). Nos otorgás una licencia limitada y no exclusiva para almacenar, procesar y mostrar tu contenido únicamente con el fin de operar y prestarte el Servicio, y a quienes lo compartas explícitamente.',
        'Sos el único responsable de tu contenido y de contar con los derechos necesarios para subirlo y compartirlo. No debés subir material que infrinja la propiedad intelectual de terceros, viole su privacidad, o que no tengas derecho a compartir.',
        'Las subidas están sujetas a límites de tipo y tamaño de archivo aplicados por el Servicio; estos límites existen para mantener el Servicio utilizable y económicamente sostenible para todos, y pueden cambiar con el tiempo.',
      ],
    },
    {
      id: 'acceptable-use',
      title: '4. Uso aceptable',
      paragraphs: [
        'Aceptás no:',
        '• Usar el Servicio para fines ilícitos, o almacenar o compartir contenido ilegal, difamatorio o infractor.',
        '• Intentar eludir los controles de acceso, sondear o escanear el Servicio en busca de vulnerabilidades, o acceder al contenido privado de otro usuario sin autorización.',
        '• Usar medios automatizados para crear cuentas, extraer datos, o generar una carga excesiva sobre el Servicio (por ejemplo, subir archivos con la intención de usarlo como almacenamiento gratuito en lugar de para su propósito previsto).',
        '• Subir malware o contenido diseñado para interrumpir o dañar el Servicio u otros usuarios.',
        'Podemos suspender o dar de baja el acceso ante conductas que violen esta sección, con o sin previo aviso, a nuestro criterio.',
      ],
    },
    {
      id: 'sharing',
      title: '5. Compartir y contenido público',
      paragraphs: [
        'Si configurás una línea de tiempo como Compartida, No listada o Pública, estás eligiendo hacer visible su contenido — y todo lo que referencie — a la audiencia correspondiente. Sos responsable de entender qué se vuelve visible antes de cambiar la visibilidad de una línea de tiempo.',
        'Cualquier persona que invites como colaboradora podrá ver o editar contenido según el rol que le otorgues. No somos responsables de lo que un colaborador invitado haga con el acceso que vos le otorgaste.',
      ],
    },
    {
      id: 'moderation',
      title: '6. Moderación y remoción',
      paragraphs: [
        'Podemos remover contenido o suspender cuentas que, de buena fe, consideremos que violan estos Términos o la ley aplicable, o cuando así lo exija un proceso legal. Generalmente intentaremos notificarte, aunque no siempre podamos hacerlo con antelación.',
      ],
    },
    {
      id: 'privacy',
      title: '7. Privacidad',
      paragraphs: [
        'Las líneas de tiempo son privadas por defecto y solo se vuelven visibles para otros mediante tus propias decisiones explícitas de compartir. Los archivos subidos se almacenan de forma privada y se sirven únicamente mediante enlaces de corta duración con verificación de autorización — nunca una URL pública y permanente.',
        'Una Política de Privacidad separada, una vez publicada, describirá con más detalle qué datos se recopilan y cómo se usan; estos Términos rigen tu uso del Servicio en general.',
      ],
    },
    {
      id: 'termination',
      title: '8. Terminación',
      paragraphs: [
        'Podés dejar de usar el Servicio y solicitar la eliminación de tu cuenta en cualquier momento. Podemos suspender o dar de baja tu acceso si violás estos Términos, o discontinuar el Servicio total o parcialmente con aviso razonable cuando sea posible.',
      ],
    },
    {
      id: 'disclaimers',
      title: '9. Exención de garantías',
      paragraphs: [
        'El Servicio se provee sin garantías de ningún tipo, expresas o implícitas, incluyendo entre otras garantías de comerciabilidad, idoneidad para un propósito particular y no infracción, en la medida máxima permitida por la ley aplicable.',
      ],
    },
    {
      id: 'liability',
      title: '10. Limitación de responsabilidad',
      paragraphs: [
        'En la medida máxima permitida por la ley, el operador del Servicio no será responsable por daños indirectos, incidentales, especiales, consecuentes o punitivos, ni por pérdida de datos, derivados del uso del Servicio.',
      ],
    },
    {
      id: 'changes',
      title: '11. Cambios a estos Términos',
      paragraphs: [
        'Podemos actualizar estos Términos periódicamente. Los cambios sustanciales se indicarán con una fecha de "Última actualización" renovada en esta página. Continuar usando el Servicio después de que los cambios entren en vigencia constituye la aceptación de los Términos revisados.',
      ],
    },
    {
      id: 'law',
      title: '12. Ley aplicable',
      paragraphs: [
        `Estos Términos se rigen por las leyes de ${OPERATOR.es.jurisdiction}, sin considerar sus principios de conflicto de leyes.`,
      ],
    },
    {
      id: 'contact',
      title: '13. Contacto',
      paragraphs: [
        `Las consultas sobre estos Términos pueden enviarse a ${OPERATOR.es.email}. El Servicio es operado por ${OPERATOR.es.name}.`,
      ],
    },
  ],
};

export function termsDocumentFor(language: string): TermsDocument {
  return language.startsWith('es') ? es : en;
}
