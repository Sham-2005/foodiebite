// ─────────────────────────────────────────────────────────────
//  backend/src/ai/safetyEngine.js
//  Production Medical & Eating-Disorder Safety Guardrail Engine
// ─────────────────────────────────────────────────────────────

const EMERGENCY_PATTERNS = [
  /chest pain/i, /severe abdominal pain/i, /blood pressure emergency/i,
  /difficulty breathing/i, /fainted/i, /loss of consciousness/i
];

const MEDICAL_PATTERNS = [
  /diagnose/i, /cure my/i, /prescription/i, /medication dosage/i, /what medicine/i, /which medicine/i,
  /insulin dose/i, /cancer diet cure/i, /disease cure/i, /take medicine/i
];

const DANGEROUS_DIET_PATTERNS = [
  /starve/i, /eat nothing/i, /0 calories/i, /zero calories/i, /survive on \d+ calories/i, /300 calories/i, /400 calories/i,
  /anorexia/i, /bulimia/i, /purge/i, /extreme fast 7 days/i
];

function evaluateSafety(text) {
  if (!text || typeof text !== 'string') {
    return { isSafetyTrigger: false };
  }

  // 1. Emergency Symptoms
  if (EMERGENCY_PATTERNS.some(p => p.test(text))) {
    return {
      isSafetyTrigger: true,
      type: 'safety',
      reply: `🚨 **URGENT HEALTH ALERT**\n\n` +
        `The symptoms you described may require immediate medical attention. ` +
        `Please contact emergency services (e.g. 102/112 or local emergency line) or visit the nearest hospital emergency room right away.\n\n` +
        `FoodieBite AI is a nutrition assistant and cannot handle medical emergencies.`
    };
  }

  // 2. Medical Diagnoses & Medication Questions
  if (MEDICAL_PATTERNS.some(p => p.test(text))) {
    return {
      isSafetyTrigger: true,
      type: 'safety',
      reply: `⚠️ **Medical & Clinical Safety Disclaimer**\n\n` +
        `FoodieBite AI provides general dietary information and meal guidance. ` +
        `We cannot diagnose medical conditions, adjust medication dosages, or prescribe treatments.\n\n` +
        `Please consult a licensed physician or certified clinical dietitian for medical diagnosis and prescriptions.`
    };
  }

  // 3. Dangerous Dieting & Eating Disorder Signals
  if (DANGEROUS_DIET_PATTERNS.some(p => p.test(text))) {
    return {
      isSafetyTrigger: true,
      type: 'safety',
      reply: `⚠️ **Nutritional & Health Warning**\n\n` +
        `Severe calorie restriction or extreme fasting can be dangerous to your organ function, metabolism, and mental health. ` +
        `FoodieBite AI promotes safe, sustainable, and balanced nutrition.\n\n` +
        `If you or someone you know is struggling with eating habits or body image, please reach out to a healthcare professional or support counselor.`
    };
  }

  return { isSafetyTrigger: false };
}

module.exports = {
  evaluateSafety
};
