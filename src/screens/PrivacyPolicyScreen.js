import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { C, BackHeader } from '../components/UI';

export default function PrivacyPolicyScreen() {
  return (
    <div className="phone-frame" style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', flexDirection: 'column' }}>
      <BackHeader title="Privacy Policy" />
      <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0 30px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(255,107,53,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <ShieldCheck size={32} color={C.orange} />
          </div>
          <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>Last Updated: May 31, 2026</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>1. Introduction</h3>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>
              Welcome to FoodieBite! We value your privacy and are committed to protecting your personal information. This Privacy Policy describes how we collect, use, and share your data when you use our mobile-first application.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>2. Data We Collect</h3>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>
              We collect information to provide a better, highly personalized experience:
            </p>
            <ul style={{ paddingLeft: 18, color: C.muted, fontSize: 13, lineHeight: 1.6, margin: '6px 0 0' }}>
              <li><strong>Account Credentials</strong>: Email addresses, names, and passwords configured via Firebase Authentication.</li>
              <li><strong>Dietary Profile</strong>: User-configured preferences, dietary selections, spice levels, allergens, and health goals saved in Cloud Firestore.</li>
              <li><strong>Medical Reports</strong>: User-uploaded health reports and documents stored securely in Cloudinary.</li>
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>3. How We Use Data</h3>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>
              Your profile preferences are used strictly to run our local nutrition scoring algorithm, ranking Open Food Facts food recommendations by seasonal fit and health goals. We never sell or share your reports.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>4. Security & Control</h3>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>
              All database records are protected by strict security rules enforcing owner-only read/write access. You can clear your search history, edit your profile details, or delete your reports directly in settings at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
