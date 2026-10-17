import { memo, useEffect, useState, type FormEvent } from 'react';
import { useGame } from '../connection';
import {
  PHASE_LABELS,
  type PublicPlayer,
  type PublicRoom,
  type WordCard as Word,
} from '@impostor/shared';
import { Avatar, Modal, asset } from '../components/ui';
import {
  ArrowRightIcon,
  CheckIcon,
  CrownIcon,
  EyeSlashIcon,
  InfoIcon,
  MonitorIcon,
  PaperPlaneTiltIcon,
  PlayIcon,
  QuestionIcon,
  SparkleIcon,
  UsersThreeIcon,
  ClockCounterClockwiseIcon,
} from '@phosphor-icons/react';
const PlayerTile = memo(function PlayerTile({
  player,
  index,
  phase,
  selected,
  selectable,
  onSelect,
  resultCount,
  isMe,
}: {
  player: PublicPlayer;
  index: number;
  phase: PublicRoom['phase'];
  selected: boolean;
  selectable: boolean;
  onSelect: (id: string) => void;
  resultCount: number | null;
  isMe: boolean;
}) {
  const pending = phase === 'CLUES' && player.alive && player.clue === null;
  const text = player.spectator
    ? 'Assistindo'
    : !player.alive
      ? 'Eliminado'
      : phase === 'VOTING'
        ? player.voted
          ? 'Voto confirmado'
          : 'Pensando no voto…'
        : (player.clue ??
          (['CLUES', 'ROLE_REVEAL'].includes(phase)
            ? ''
            : phase === 'LOBBY'
              ? 'Na sala'
              : 'Sem dica'));
  return (
    <button
      className={`player-tile ${!player.alive ? 'eliminated' : ''} ${selectable ? 'selectable' : ''} ${selected ? 'suspect' : ''} ${player.clue ? 'answered' : ''}`}
      disabled={!selectable}
      onClick={() => onSelect(player.id)}
      aria-label={
        selectable ? `Votar em ${player.name}` : `${player.name}, ${text || 'Aguardando dica'}`
      }
      aria-pressed={selected}
    >
      <span className="seat-number">{String(index + 1).padStart(2, '0')}</span>
      <Avatar index={player.avatar} className={player.clue ? 'avatar-answered' : ''} />
      <span className="player-message">
        <span className="player-name" title={player.name}>
          {player.name}
          {isMe && <small> você</small>}
          <i
            className={`status-dot ${player.online ? 'online' : ''}`}
            title={player.online ? 'Conectado' : 'Desconectado'}
          />
        </span>
        <span className={`speech-bubble ${pending ? 'pending' : ''}`}>
          {pending ? (
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          ) : (
            text || 'Aguardando…'
          )}
        </span>
      </span>
      {resultCount !== null && (
        <span className="vote-count">
          {resultCount} <small>{resultCount === 1 ? 'voto' : 'votos'}</small>
        </span>
      )}
      {selected && <CheckIcon className="selected-check" />}
    </button>
  );
});
function ItemImage({ word }: { word: Word }) {
  return (
    <img
      className="item-image"
      src={asset(word.imagem)}
      alt={word.nome}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = asset('assets/items/fallback.svg');
      }}
    />
  );
}
function SecretCard() {
  const { room, privateState } = useGame();
  const [peek, setPeek] = useState(false);
  const word = privateState && 'word' in privateState ? privateState.word : null;
  const impostor = privateState?.kind === 'player' && privateState.role === 'impostor';
  const teacher = privateState?.kind === 'teacher';
  const display = privateState?.kind === 'display';
  const me = room!.players.find(
    (p) => privateState?.kind === 'player' && p.id === privateState.playerId,
  );
  const eliminated = me && !me.alive && !me.spectator;
  const voting = [
    'VOTING',
    'VOTE_RESULTS',
    'TIEBREAK',
    'ELIMINATION',
    'WAITING_FOR_NEXT_ROUND',
  ].includes(room!.phase);
  const result = room!.result;
  if (result) {
    const p = room!.players.find((p) => p.id === result.impostorId);
    return (
      <section
        className={`secret-card result-card ${result.winner === 'impostor' ? 'impostor-wins' : ''}`}
      >
        <span className="card-overline">MISTÉRIO RESOLVIDO</span>
        <SparkleIcon className="result-sparkle" weight="fill" />
        <h1>
          {result.winner === 'civis'
            ? 'VITÓRIA DOS CIVIS!'
            : result.winner === 'impostor'
              ? 'VITÓRIA DO IMPOSTOR!'
              : 'PARTIDA ENCERRADA'}
        </h1>
        <Avatar index={p?.avatar ?? 0} />
        <p>
          O impostor era <strong>{p?.name}</strong>
        </p>
        <div className="result-word">
          <ItemImage word={result.word} />
          <div>
            <small>A PALAVRA SECRETA ERA</small>
            <strong>{result.word.nome}</strong>
          </div>
        </div>
        <span className="subtle">
          {room!.round} {room!.round === 1 ? 'rodada' : 'rodadas'} ·{' '}
          {room!.eliminations.filter((e) => e.playerId !== result.impostorId).length} civis
          eliminados
        </span>
      </section>
    );
  }
  if (voting) {
    const eliminatedPlayer = room!.players.find((p) => p.id === room!.voteResult?.eliminatedId);
    return (
      <section className="secret-card voting-card">
        <span className="card-overline">CONFIE NA SUA INVESTIGAÇÃO</span>
        <div className="mystery-symbol">
          <QuestionIcon weight="duotone" />
        </div>
        <h1>
          {room!.phase === 'ELIMINATION'
            ? `${eliminatedPlayer?.name} saiu da investigação.`
            : room!.phase === 'TIEBREAK'
              ? 'A turma ficou dividida!'
              : room!.phase === 'VOTE_RESULTS'
                ? room!.voteResult?.noVotes
                  ? 'Nenhum voto recebido'
                  : room!.voteResult?.tied.length
                    ? 'Temos um empate!'
                    : 'A turma decidiu…'
                : room!.phase === 'WAITING_FOR_NEXT_ROUND'
                  ? 'O mistério continua.'
                  : 'Quem é o impostor?'}
        </h1>
        <p>
          {room!.phase === 'VOTING'
            ? 'Observe as pistas e escolha um suspeito. Seu voto é secreto.'
            : room!.phase === 'TIEBREAK'
              ? 'O professor pode abrir uma votação entre os empatados.'
              : room!.phase === 'WAITING_FOR_NEXT_ROUND'
                ? 'O professor iniciará uma nova rodada de dicas.'
                : room!.phase === 'ELIMINATION'
                  ? 'Os sobreviventes continuam. O papel permanece em segredo.'
                  : 'Confira a contagem ao lado de cada personagem.'}
        </p>
        <span className="category-badge">{room!.category}</span>
        {eliminated && (
          <span className="eliminated-label">Você foi eliminado. Continue assistindo!</span>
        )}
      </section>
    );
  }
  return (
    <section className={`secret-card ${impostor ? 'impostor-card' : ''}`}>
      <span className="card-overline">
        {display
          ? 'INVESTIGAÇÃO EM ANDAMENTO'
          : teacher
            ? 'PAINEL PRIVADO DO PROFESSOR'
            : impostor
              ? 'SEU PAPEL É SECRETO'
              : 'SUA PALAVRA SECRETA'}
      </span>
      {word && !display ? (
        <>
          <div className="item-stage">
            <ItemImage word={word} />
          </div>
          <h1 className="word-name">{word.nome}</h1>
        </>
      ) : (
        <>
          <div className="mystery-symbol">
            <QuestionIcon weight="duotone" />
          </div>
          <h1>
            {impostor
              ? 'VOCÊ É O IMPOSTOR'
              : display
                ? 'QUEM ESTÁ BLEFANDO?'
                : 'VOCÊ ESTÁ ASSISTINDO'}
          </h1>
          <p>
            {impostor
              ? 'Você não conhece a palavra. Observe as dicas e entre no jogo!'
              : display
                ? 'As pistas estão chegando. Observe, converse e investigue.'
                : 'Acompanhe as pistas da turma sem revelar os segredos.'}
          </p>
        </>
      )}
      <span className="category-badge">Categoria: {room!.category}</span>
      {teacher && (
        <>
          <button className="teacher-peek" onClick={() => setPeek(!peek)}>
            <EyeSlashIcon />
            {peek ? 'Ocultar impostor' : 'Consultar impostor em segredo'}
          </button>
          {peek && (
            <strong className="impostor-name">
              {
                room!.players.find(
                  (p) =>
                    p.id === (privateState?.kind === 'teacher' ? privateState.impostorId : null),
                )?.name
              }
            </strong>
          )}
        </>
      )}
      {eliminated && (
        <span className="eliminated-label">Você foi eliminado. Continue assistindo!</span>
      )}
    </section>
  );
}
function TeacherControls() {
  const { room, send, busy } = useGame();
  const [confirm, setConfirm] = useState(false);
  const phase = room!.phase;
  return (
    <div className="teacher-controls">
      <span className="control-label">
        <CrownIcon /> CONTROLE DO PROFESSOR
      </span>
      {phase === 'CLUES' && (
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void send({ type: 'clues:close' })}
        >
          Encerrar dicas
        </button>
      )}
      {['WAITING_FOR_VOTE', 'TIEBREAK'].includes(phase) && (
        <button
          className="primary"
          disabled={busy}
          onClick={() => void send({ type: 'vote:open' })}
        >
          <PlayIcon weight="fill" />
          {phase === 'TIEBREAK' ? 'Abrir desempate' : 'Abrir votação'}
        </button>
      )}
      {phase === 'VOTING' && (
        <button
          className="primary"
          disabled={busy}
          onClick={() => void send({ type: 'vote:close' })}
        >
          <CheckIcon /> Encerrar votação
        </button>
      )}
      {phase === 'WAITING_FOR_NEXT_ROUND' && (
        <button
          className="primary"
          disabled={busy}
          onClick={() => void send({ type: 'round:next' })}
        >
          Próxima rodada <ArrowRightIcon />
        </button>
      )}
      {phase === 'GAME_OVER' && (
        <button
          className="primary"
          disabled={busy}
          onClick={() => void send({ type: 'game:reset' })}
        >
          <PlayIcon /> Iniciar nova partida
        </button>
      )}
      {['ROLE_REVEAL', 'VOTE_RESULTS', 'ELIMINATION'].includes(phase) && (
        <span className="subtle">Aguarde a revelação…</span>
      )}
      {phase !== 'GAME_OVER' && (
        <button className="danger-link" onClick={() => setConfirm(true)}>
          Encerrar partida
        </button>
      )}
      {confirm && (
        <Modal title="Encerrar esta partida?" onClose={() => setConfirm(false)}>
          <p>Os alunos verão o resultado e a palavra secreta. Ninguém será declarado vencedor.</p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setConfirm(false)}>
              Continuar jogando
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void send({ type: 'game:end' }).then((ok) => {
                  if (ok) setConfirm(false);
                })
              }
            >
              Encerrar partida
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function GameBoard() {
  const { room, privateState, send, busy, connected, offset } = useGame();
  const state = room!;
  const [now, setNow] = useState(Date.now());
  const [clue, setClue] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  useEffect(() => {
    if (!['CLUES', 'ROLE_REVEAL'].includes(state.phase)) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [state.phase, state.deadline]);
  useEffect(() => {
    setClue('');
    setSelected(null);
  }, [state.round, state.phase]);
  const teacher = privateState?.kind === 'teacher';
  const display = privateState?.kind === 'display';
  const me = state.players.find(
    (p) => privateState?.kind === 'player' && p.id === privateState.playerId,
  );
  const alive = state.players.filter((p) => p.alive && !p.spectator);
  const people = state.players.filter((p) => !p.spectator);
  const midpoint = Math.ceil(people.length / 2);
  const remaining = state.deadline
    ? Math.max(0, Math.ceil((state.deadline - now - offset) / 1000))
    : 0;
  const clueCount = alive.filter((p) => p.clue !== null).length;
  const voteCount = alive.filter((p) => p.voted).length;
  const voting = state.phase === 'VOTING';
  const canVote = !!me && me.alive && !me.spectator && !me.voted && voting && connected;
  const canClue =
    !!me && me.alive && !me.spectator && me.clue === null && state.phase === 'CLUES' && connected;
  const showCounts =
    ['VOTE_RESULTS', 'TIEBREAK', 'ELIMINATION', 'WAITING_FOR_NEXT_ROUND', 'GAME_OVER'].includes(
      state.phase,
    ) && state.voteResult;
  const tile = (p: PublicPlayer, i: number) => (
    <PlayerTile
      key={p.id}
      player={p}
      index={i}
      phase={state.phase}
      selected={selected === p.id}
      selectable={
        canVote &&
        p.alive &&
        p.id !== me?.id &&
        (!state.candidates.length || state.candidates.includes(p.id))
      }
      onSelect={setSelected}
      resultCount={showCounts ? (state.voteResult!.counts[p.id] ?? 0) : null}
      isMe={p.id === me?.id}
    />
  );
  const sendClue = (e: FormEvent) => {
    e.preventDefault();
    if (canClue && clue.trim()) void send({ type: 'clue:submit', text: clue });
  };
  return (
    <main className={`game-board ${state.phase === 'GAME_OVER' ? 'game-finished' : ''}`}>
      {state.result && state.result.winner !== 'cancelada' && (
        <div className="celebration" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <span
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: ['#ffce45', '#2ce3ba', '#80a8ff'][i % 3],
                animationDelay: `${i * 0.11}s`,
              }}
            />
          ))}
        </div>
      )}
      <div className="game-meta">
        <span className="pill">
          <UsersThreeIcon /> {alive.length} vivos
        </span>
        <span className="round-label">
          RODADA <b>{String(state.round).padStart(2, '0')}</b>
        </span>
        <button className="ghost" onClick={() => setHistory(true)}>
          <ClockCounterClockwiseIcon /> Histórico
        </button>
      </div>
      <div className="board-layout">
        <section className="player-column left-column" aria-label="Participantes da esquerda">
          {people.slice(0, midpoint).map(tile)}
        </section>
        <section className="board-center">
          <div
            className={`phase-panel ${state.phase === 'CLUES' && remaining <= 10 ? 'urgent' : ''}`}
          >
            <div className="phase-label">
              Fase: <strong>{PHASE_LABELS[state.phase]}</strong>
            </div>
            {['CLUES', 'ROLE_REVEAL'].includes(state.phase) ? (
              <div
                className="countdown"
                role="timer"
                aria-label={`${remaining} segundos restantes`}
              >
                {String(Math.floor(remaining / 60)).padStart(2, '0')}
                <span>:</span>
                {String(remaining % 60).padStart(2, '0')}
              </div>
            ) : (
              <div className="phase-status">
                {voting
                  ? 'Quem merece seu voto?'
                  : state.phase === 'WAITING_FOR_VOTE'
                    ? clueCount === alive.length
                      ? 'Todos responderam!'
                      : 'Dicas encerradas'
                    : state.phase === 'GAME_OVER'
                      ? 'Investigação concluída'
                      : 'Cada pista conta.'}
              </div>
            )}
            <div className="response-progress">
              <div
                style={{
                  width: `${((voting ? voteCount : clueCount) / Math.max(1, alive.length)) * 100}%`,
                }}
              />
            </div>
            <p>
              <strong>
                {voting ? voteCount : clueCount}/{alive.length}
              </strong>{' '}
              {voting ? 'votos confirmados' : 'dicas enviadas'}
            </p>
          </div>
          <SecretCard />
          <div className="action-panel panel">
            {teacher ? (
              <TeacherControls />
            ) : display ? (
              <div className="display-message">
                <MonitorIcon />
                <span>
                  {state.phase === 'VOTING'
                    ? 'Votos secretos. Escolha no seu dispositivo.'
                    : 'Conversem com respeito. Cada pista conta!'}
                </span>
              </div>
            ) : voting ? (
              <>
                <p>
                  {me?.voted ? (
                    <>
                      <CheckIcon /> Voto confirmado. Aguarde o professor.
                    </>
                  ) : canVote ? (
                    'Escolha um personagem e confirme seu voto.'
                  ) : (
                    'Você está assistindo à votação.'
                  )}
                </p>
                {canVote && (
                  <button
                    className="primary full"
                    disabled={!selected || busy}
                    onClick={() => {
                      if (selected)
                        void send({ type: 'vote:submit', targetId: selected }).then((ok) => {
                          if (ok) setSelected(null);
                        });
                    }}
                  >
                    <CheckIcon />{' '}
                    {selected
                      ? `Votar em ${state.players.find((p) => p.id === selected)?.name}`
                      : 'Selecione um suspeito'}
                  </button>
                )}
              </>
            ) : state.phase === 'CLUES' ? (
              <>
                <p>
                  <SparkleIcon weight="fill" />
                  {me?.clue !== null && me?.clue !== undefined
                    ? 'Dica enviada! Observe as pistas dos colegas.'
                    : canClue
                      ? 'Escreva uma dica curta sem revelar demais.'
                      : 'Você está assistindo à investigação.'}
                </p>
                {me?.alive && !me.spectator && (
                  <form className="clue-form" onSubmit={sendClue}>
                    <div className="clue-input-wrap">
                      <input
                        aria-label="Sua dica"
                        maxLength={80}
                        value={clue}
                        onChange={(e) => setClue(e.target.value)}
                        disabled={!canClue || busy}
                        placeholder={me.clue ?? 'Digite aqui sua dica…'}
                      />
                      <small>{Array.from(clue).length}/80</small>
                    </div>
                    <button className="primary" disabled={!canClue || !clue.trim() || busy}>
                      <PaperPlaneTiltIcon weight="fill" /> Enviar
                    </button>
                  </form>
                )}
              </>
            ) : (
              <div className="display-message">
                <InfoIcon />
                <span>
                  {state.phase === 'ROLE_REVEAL'
                    ? 'Confira seu papel em segredo. A rodada vai começar!'
                    : state.phase === 'WAITING_FOR_VOTE'
                      ? 'Conversem sobre as dicas. O professor abrirá a votação.'
                      : state.phase === 'GAME_OVER'
                        ? 'Aguarde o professor preparar uma nova partida.'
                        : 'Aguarde o professor continuar a investigação.'}
                </span>
              </div>
            )}
          </div>
        </section>
        <section className="player-column right-column" aria-label="Participantes da direita">
          {people.slice(midpoint).map((p, i) => tile(p, i + midpoint))}
        </section>
      </div>
      {history && (
        <Modal title="Histórico da investigação" onClose={() => setHistory(false)}>
          <div className="history-list">
            {state.history.map((h) => (
              <section key={h.round}>
                <h3>Rodada {h.round}</h3>
                {h.clues.length ? (
                  h.clues.map((c) => (
                    <p key={c.playerId}>
                      <strong>{c.name}:</strong> {c.text}
                    </p>
                  ))
                ) : (
                  <p className="subtle">As dicas desta rodada ainda estão chegando.</p>
                )}
                {h.votes.map((v, i) => (
                  <p className="history-vote" key={i}>
                    {v.runoff ? 'Desempate' : 'Votação'}:{' '}
                    {v.noVotes
                      ? 'sem votos'
                      : v.tied.length
                        ? 'empate'
                        : state.players.find((p) => p.id === v.eliminatedId)?.name +
                          ' recebeu mais votos'}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </Modal>
      )}
    </main>
  );
}
