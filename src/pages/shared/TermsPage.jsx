import { Card } from '../../components/common/Card';
import { PageSEO } from '../../components/common/PageSEO';
import { SectionHeading } from '../../components/common/SectionHeading';
import { AppShell } from '../../components/layout/AppShell';

const rules = [
  'Users must provide accurate identity, phone, profile, location, booking, and payment information.',
  'Clients and labour professionals must use Slivz only for lawful service requests and lawful work.',
  'Users must not post fake profiles, misleading skills, abusive messages, unsafe requests, illegal work, spam, or content that violates Indian law.',
  'Labour professionals are independent service providers. Slivz helps with discovery, booking, communication, and records, but does not employ labour users.',
  'Bookings, cancellations, disputes, refunds, reviews, and account restrictions may be handled according to platform records, user evidence, and applicable Indian consumer and cyber laws.',
  'Slivz may suspend or remove accounts that misuse the platform, create safety risk, violate these terms, or receive credible legal or government requests.'
];

const references = [
  'Information Technology Act, 2000 and applicable rules for electronic records, cyber safety, and lawful platform use.',
  'Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 for intermediary due diligence, user conduct, and grievance handling where applicable.',
  'Consumer Protection Act, 2019 and Consumer Protection (E-Commerce) Rules, 2020 for fair marketplace practices where applicable.',
  'Indian Contract Act, 1872 for valid agreements between users where applicable.'
];

const TermsPage = () => (
  <AppShell>
    <PageSEO
      title="Terms & Conditions"
      description="Terms and conditions for using Slivz as a client or labour professional."
    />

    <section className="section-space">
      <div className="page-shell">
        <Card className="rounded-[32px]">
          <SectionHeading
            eyebrow="Legal"
            title="Terms & Conditions"
            description="These terms explain the basic rules for using Slivz. They are written for India-based marketplace use and should be reviewed by a qualified legal professional before production launch."
          />

          <div className="mt-8 grid gap-8 text-sm leading-7 text-slate-600 dark:text-slate-300">
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">Platform Rules</h2>
              <ul className="mt-3 grid gap-2">
                {rules.map((item) => (
                  <li key={item} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">Government Law References</h2>
              <ul className="mt-3 grid gap-2">
                {references.map((item) => (
                  <li key={item} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <p>
              Grievance and support requests can be sent to support@slivz.app. Slivz may update these terms as laws, product features, or marketplace operations change.
            </p>
          </div>
        </Card>
      </div>
    </section>
  </AppShell>
);

export default TermsPage;
