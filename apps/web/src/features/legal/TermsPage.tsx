import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '@timeline/shared';
import { LogoFull } from '../../components/brand/LogoFull';
import { termsDocumentFor } from './terms-content';

/**
 * Standalone route (`/terms`), reachable both signed-in and signed-out —
 * a Terms page that only worked for one audience would defeat the point.
 */
export function TermsPage() {
  const { t, i18n } = useTranslation();
  const doc = termsDocumentFor(i18n.language);

  return (
    <div className="min-h-screen bg-bg px-6 py-10 md:px-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0 rounded-md">
            <LogoFull size={26} />
          </Link>
          <Link
            to="/dashboard"
            className="text-sm text-text-secondary underline-offset-4 hover:text-text hover:underline"
          >
            {t('legal.backToApp')}
          </Link>
        </div>

        <div>
          <h1 className="font-serif text-3xl text-text">{doc.metaTitle}</h1>
          <p className="mt-2 font-mono text-xs text-text-muted">
            {doc.lastUpdatedLabel}: {doc.effectiveDate} · v{APP_VERSION}
          </p>
        </div>

        <p className="text-sm leading-relaxed text-text-secondary">{doc.intro}</p>

        <div className="flex flex-col gap-8">
          {doc.sections.map((section) => (
            <section key={section.id} className="flex flex-col gap-3">
              <h2 className="font-serif text-xl text-text">{section.title}</h2>
              {section.paragraphs.map((paragraph, i) =>
                paragraph.startsWith('• ') ? (
                  <ul key={i} className="list-none pl-0">
                    <li className="text-sm leading-relaxed text-text-secondary">
                      {paragraph.slice(2)}
                    </li>
                  </ul>
                ) : (
                  <p key={i} className="text-sm leading-relaxed text-text-secondary">
                    {paragraph}
                  </p>
                ),
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
