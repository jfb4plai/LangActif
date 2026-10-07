// Texte à faire valider par les écoles avant diffusion (spec 3a, §8.3).
export function PrivacyInfo() {
  return (
    <details className="plai-card" style={{ marginTop: 16 }}>
      <summary style={{ cursor: 'pointer', fontSize: 16, minHeight: 44 }}>Comment mes données sont-elles utilisées ?</summary>
      <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 1.7 }}>
        <li>LangActif t'aide à apprendre du vocabulaire.</li>
        <li>L'application connaît ton pseudo et ton code.</li>
        <li>Elle ne connaît pas ton nom.</li>
        <li>Elle ne connaît pas ton adresse e-mail.</li>
        <li>Ton enseignant sait quel pseudo est le tien.</li>
        <li>Ton enseignant peut voir ton travail dans LangActif.</li>
        <li>Ton enseignant peut effacer ton pseudo et ton travail.</li>
        <li>Tu peux lui demander de les effacer.</li>
        <li>Si tu as une question, parle à ton enseignant.</li>
      </ul>
    </details>
  );
}
