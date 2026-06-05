import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { PageSEO } from '../../components/common/PageSEO';
import { SectionHeading } from '../../components/common/SectionHeading';
import { AppShell } from '../../components/layout/AppShell';

const terms = [
  'Users must provide accurate identity, phone, profile, location, booking, and payment information.',
  'Clients and labour professionals must use Slivz only for lawful service requests and lawful work.',
  'Users must not post fake profiles, misleading skills, abusive messages, unsafe requests, illegal work, spam, or content that violates Indian law.',
  'Labour professionals are independent service providers. Slivz helps with discovery, booking, communication, and records, but does not employ labour users.',
  'Bookings, cancellations, disputes, refunds, reviews, and account restrictions may be handled according to platform records, user evidence, and applicable Indian consumer and cyber laws.',
  'Slivz may suspend or remove accounts that misuse the platform, create safety risk, violate these terms, or receive credible legal or government requests.',
  'Applicable references include the Information Technology Act, 2000, IT Rules 2021, Consumer Protection Act 2019, E-Commerce Rules 2020, and Indian Contract Act 1872.'
];

const NumberedRows = ({ items }) => (
  <div className="mt-6 overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-900">
    {items.map((item, index) => (
      <div key={item} className="grid grid-cols-[2.25rem_1fr] gap-3 px-3 py-3 text-sm leading-6 text-slate-700 sm:grid-cols-[3rem_1fr] sm:px-4 dark:text-slate-300">
        <span className="font-black text-slate-950 dark:text-white">{index + 1}</span>
        <p>{item}</p>
      </div>
    ))}
  </div>
);

const TermsPage = () => (
  <AppShell>
    <PageSEO
      title="Terms & Conditions"
      description="Terms and conditions for using Slivz as a client or labour professional."
    />

    <section className="section-space">
      <div className="page-shell">
        <Card className="rounded-[32px]">
          <Link
            to="/auth?role=client&mode=login"
            className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-950"
          >
            <ArrowLeft size={17} />
            Back to login
          </Link>

          <SectionHeading
            eyebrow="Legal"
            title="Terms & Conditions"
            description="Slivz platform rules in simple numbered rows."
          />

          <NumberedRows items={terms} />

          <p className="mt-6 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
            Support: support@slivz.app
          </p>
        </Card>
      </div>
    </section>
  </AppShell>
);

export default TermsPage;
