import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { PageSEO } from '../../components/common/PageSEO';
import { SectionHeading } from '../../components/common/SectionHeading';
import { AppShell } from '../../components/layout/AppShell';

const privacyRules = [
  'Slivz may collect account details, phone number, profile information, role, skills, photos, location, bookings, chat records, reviews, notifications, and security logs.',
  'Data is used to create accounts, verify users, match clients with labour professionals, process bookings, improve safety, prevent fraud, provide support, and comply with lawful requests.',
  'Location data is used for nearby search, booking routing, directions, live work status, and safety features when the user grants permission.',
  'Slivz may share required booking and profile information between clients and labour professionals so services can be requested, accepted, completed, reviewed, or disputed.',
  'Users may request correction, access, withdrawal of consent, or deletion where supported by applicable law and operational requirements.',
  'Slivz uses reasonable technical and organisational safeguards, but no online service can guarantee absolute security.',
  'Applicable references include the Digital Personal Data Protection Act 2023, DPDP Rules 2025 where applicable, Information Technology Act 2000, and Consumer Protection E-Commerce Rules 2020.'
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

const PrivacyPage = () => (
  <AppShell>
    <PageSEO
      title="Privacy Policy"
      description="Privacy policy for Slivz account, booking, location, and marketplace data."
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
            title="Privacy Policy"
            description="Slivz privacy rules in simple numbered rows."
          />

          <NumberedRows items={privacyRules} />

          <p className="mt-6 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
            Support: support@slivz.app
          </p>
        </Card>
      </div>
    </section>
  </AppShell>
);

export default PrivacyPage;
