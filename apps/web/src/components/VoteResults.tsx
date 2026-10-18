import type { CSSProperties } from 'react';
import type { PublicRoom, VoteResult } from '@impostor/shared';
import { ClipboardTextIcon, CrownIcon, TrophyIcon } from '@phosphor-icons/react';
import { Avatar, Modal } from './ui';
import { voteRanking } from '../vote-results';

export function VoteResultsModal({
  room,
  result,
  onClose,
}: {
  room: PublicRoom;
  result: VoteResult;
  onClose: () => void;
}) {
  const rows = voteRanking(room.players, result);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <Modal title="Resultado da votação" className="vote-results-modal" onClose={onClose}>
      <div className="ranking-emblem" aria-hidden="true">
        <ClipboardTextIcon weight="duotone" />
      </div>
      <header className="ranking-header">
        <h2>
          RESULTADO DA <span>VOTAÇÃO</span>
        </h2>
        <p>{result.runoff ? 'Confira os votos do desempate' : 'Veja quem recebeu mais votos'}</p>
        <div className="ranking-total">
          <span>
            {total} {total === 1 ? 'voto computado' : 'votos computados'}
          </span>
        </div>
      </header>
      <p className="ranking-abstentions">
        {result.abstentions ?? 0} {(result.abstentions ?? 0) === 1 ? 'abstenção' : 'abstenções'} ·
        sem votos em jogadores
      </p>
      {rows.length ? (
        <ol className="vote-ranking" aria-label="Ranking dos votos" tabIndex={0}>
          {rows.map(({ player, count, rank, tied, leader, fraction, durationMs }) => (
            <li
              key={player.id}
              className={`ranking-row ${leader ? 'ranking-leader' : ''}`}
              data-votes={count}
            >
              <div
                className="ranking-position"
                aria-label={`${rank}º lugar${tied ? ', empatado' : ''}`}
              >
                {leader && <CrownIcon weight="fill" aria-hidden="true" />}
                <strong>{rank}º</strong>
                {tied && <small>=</small>}
              </div>
              <Avatar index={player.avatar} />
              <div className="ranking-player">
                <strong title={player.name}>{player.name}</strong>
                <div
                  className="ranking-track"
                  role="meter"
                  aria-label={`Votos em ${player.name}`}
                  aria-valuenow={count}
                  aria-valuemin={0}
                  aria-valuemax={rows[0].count}
                >
                  <div
                    className="ranking-fill"
                    style={
                      {
                        '--vote-fraction': fraction,
                        '--fill-duration': `${durationMs}ms`,
                      } as CSSProperties
                    }
                  />
                </div>
              </div>
              <div className="ranking-count">
                <strong>{count}</strong>
                <span>{count === 1 ? 'voto' : 'votos'}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ranking-empty">Nenhum voto foi recebido nesta votação.</p>
      )}
      <footer className="ranking-footer">
        <TrophyIcon weight="duotone" aria-hidden="true" />
        <strong>
          {result.noVotes
            ? 'SEM VOTOS'
            : result.protectedId
              ? 'O ESCUDO RESISTIU!'
              : result.tied.length
                ? 'EMPATE!'
                : 'VOTOS APURADOS'}
        </strong>
        <span>
          {result.protectedId
            ? 'Ninguém será eliminado nesta votação.'
            : 'A investigação continua no ritmo do professor.'}
        </span>
      </footer>
      <i className="ranking-spark spark-one" aria-hidden="true">
        ✦
      </i>
      <i className="ranking-spark spark-two" aria-hidden="true">
        ✦
      </i>
    </Modal>
  );
}
