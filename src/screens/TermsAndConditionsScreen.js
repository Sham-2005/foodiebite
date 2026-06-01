import React from 'react';
import { FileText } from 'lucide-react';
import { C, BackHeader } from '../components/UI';

export default function TermsAndConditionsScreen() {
  return (
    <div className="phone-frame" style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', flexDirection: 'column' }}>
      <BackHeader title="Terms & Conditions" />
      <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0 30px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(255,107,53,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <FileText size={32} color={C.orange} />
          </div>
          <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>Last Updated: May 31, 2026</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>1. Agreement to Terms</h3>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>
              By accessing or using the FoodieBite mobile-first web app, you agree to comply with and be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the application.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>2. Informational Purpose Only</h3>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>
              All recommendations, nutrient calculations, and medical report insights provided by FoodieBite are for **informational and educational purposes only**. They do not constitute medical advice, diagnosis, or treatment. Always consult a healthcare professional before modifying your diet.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>3. User Conduct & Accounts</h3>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>
              You are responsible for safeguarding your login credentials. You agree to provide accurate registration information (including age and gender inputs) to ensure that the nutrient rankers produce precise, safe outputs.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>4. External Data Sources</h3>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>
              FoodieBite integrates Open Food Facts and public weather data APIs. While we make every attempt to filter out allergens and score grade tags precisely, we cannot guarantee the absolute completeness or accuracy of third-party datasets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
