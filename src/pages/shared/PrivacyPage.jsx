import { Card } from '../../components/common/Card';
import { PageSEO } from '../../components/common/PageSEO';
import { SectionHeading } from '../../components/common/SectionHeading';
import { AppShell } from '../../components/layout/AppShell';

const privacyItems = [
  'Slivz may collect account details, phone number, profile information, role, skills, photos, location, bookings, chat records, reviews, notifications, and device or security logs.',
  'Data is used to create accounts, verify users, match clients with labour professionals, process bookings, improve safety, prevent fraud, provide support, and comply with lawful requests.',
  'Location data is used for nearby search, booking routing, directions, live work status, and safety features when the user grants permission.',
  'Slivz may share required booking and profile information between clients and labour professionals so services can be requested, accepted, completed, reviewed, or disputed.',
  'Users may request correction, access, withdrawal of consent, or deletion where supported by applicable law and operational requirements.',
  'Slivz uses reasonable technical and organisational safeguards, but no online service can guarantee absolute security.'
];

const lawItems = [
  'Digital Personal Data Protection Act, 2023 for processing digital personal data for lawful purposes and recognising user privacy rights.',
  'Digital Personal Data Protection Rules, 2025 where notified and applicable.',
  'Information Technology Act, 2000 and applicable rules for electronic records, cyber security, and lawful disclosure.',
  'Consumer Protection Act, 2019 and Consumer Protection (E-Commerce) Rules, 2020 where marketplace consumer disclosures are applicable.'
];

const PrivacyPage = () => (
  <AppShell>
    <PageSEO
      title="Privacy Policy"
      description="Privacy policy for Slivz account, booking, location, and marketplace data."
    />

    <section className="section-space">
      <div className="page-shell">
        <Card className="rounded-[32px]">
          <SectionHeading
            eyebrow="Legal"
            title="Privacy Policy"
            description="This policy explains how Slivz handles user data. It is a practical draft for India-based use and should be reviewed by a qualified legal professional before production launch."
          />

          <div className="mt-8 grid gap-8 text-sm leading-7 text-slate-600 dark:text-slate-300">
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">Data Use</h2>
              <ul className="mt-3 grid gap-2">
                {privacyItems.map((item) => (
                  <li key={item} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">Government Law References</h2>
              <ul className="mt-3 grid gap-2">
                {lawItems.map((item) => (
                  <li key={item} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <p>
              Privacy and data requests can be sent to support@slivz.app. Slivz may retain records needed for security, legal compliance, fraud prevention, dispute resolution, and accounting.
            </p>
          </div>
        </Card>
      </div>
    </section>
  </AppShell>
);

export default PrivacyPage;
