import type { GuideSection } from '@/lib/templates';

export function PlanGuide({ sections }: { sections: GuideSection[] }) {
  return (
    <div className="guide">
      {sections.map((s, i) => (
        <details key={s.title} open={i === 0}>
          <summary>{s.title}</summary>
          <div className="gbody">
            {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
            {s.bullets && (
              <ul>
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {s.table && (
              <div className="tbl-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      {s.table.head.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((r) => (
                      <tr key={r.join('|')}>
                        {r.map((cell, j) => (
                          <td key={j} className={cell === '' ? 'dim' : undefined}>
                            {cell === '' ? '·' : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.after?.map((p) => <p key={p}>{p}</p>)}
          </div>
        </details>
      ))}
    </div>
  );
}
