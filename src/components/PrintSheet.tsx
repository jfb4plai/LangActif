import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Slip } from '../lib/slips';
import { useFocusOnMount } from '../lib/useFocusOnMount';

interface Props {
  title: string;
  slips: Slip[];
  doneLabel: string;
  onDone: () => void;
}

function SlipCard({ slip }: { slip: Slip }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(slip.url, { margin: 1, width: 160 })
      .then((u) => alive && setQr(u))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [slip.url]);

  return (
    <div className="lang-slip">
      <p className="lang-slip-app">LangActif</p>
      <dl>
        <dt>Groupe</dt>
        <dd>{slip.groupCode}</dd>
        <dt>Pseudo</dt>
        <dd>{slip.pseudo}</dd>
        <dt>Code</dt>
        <dd className="lang-slip-code">{slip.code}</dd>
      </dl>
      {qr && <img src={qr} alt="QR code vers la page de connexion du groupe" width={110} height={110} />}
      <p className="lang-slip-url">{slip.url.replace(/^https?:\/\//, '').split('?')[0]}</p>
      <p className="lang-slip-name">Nom : ____________________</p>
    </div>
  );
}

export function PrintSheet({ title, slips, doneLabel, onDone }: Props) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  return (
    <section>
      <div className="lang-no-print">
        <h1 ref={headingRef} tabIndex={-1} className="font-serif" style={{ fontSize: 26, marginBottom: 12 }}>{title}</h1>
        <div className="plai-banner" role="alert">
          Les codes ne seront plus affichés après cette page. Imprimez les fiches maintenant ou notez les codes. Si une fiche
          est perdue, vous pourrez générer un nouveau code pour cette place.
        </div>
        <p style={{ margin: '12px 0' }}>
          Écrivez le nom de l'élève au crayon sur sa bande. La correspondance entre le pseudo et le nom reste dans votre carnet,
          jamais dans l'application.
        </p>
        <p style={{ margin: '12px 0' }}>
          Si les élèves utilisent des tablettes ou des ordinateurs de l'école, rappelez-leur de cocher la case « appareil de l'école »
          à la connexion. Sans cela, l'élève suivant pourrait entrer avec le pseudo du précédent.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <button type="button" className="plai-btn" onClick={() => window.print()}>Imprimer les fiches</button>
          <button type="button" className="plai-btn-ghost" onClick={onDone}>{doneLabel}</button>
        </div>
      </div>
      <div className="lang-slips">
        {slips.map((s) => (
          <SlipCard key={s.pseudo} slip={s} />
        ))}
      </div>
    </section>
  );
}
