import { memo, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRightIcon,
  ArrowsOutIcon,
  CheckIcon,
  CopyIcon,
  CrownIcon,
  DoorOpenIcon,
  EyeSlashIcon,
  GameControllerIcon,
  GearIcon,
  InfoIcon,
  MonitorIcon,
  PaperPlaneTiltIcon,
  PlayIcon,
  QuestionIcon,
  ShieldCheckIcon,
  SparkleIcon,
  TrashIcon,
  UsersThreeIcon,
  WifiHighIcon,
  XIcon,
  ClockCounterClockwiseIcon,
} from '@phosphor-icons/react';
import {
  CATEGORIES,
  PHASE_LABELS,
  type PublicPlayer,
  type PublicRoom,
  type Settings,
  type WordCard as Word,
} from '@impostor/shared';
import { useGame } from './connection';

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;
const palette = [
  'Vermelho',
  'Azul',
  'Amarelo',
  'Verde',
  'Roxo',
  'Laranja',
  'Turquesa',
  'Rosa',
  'Branco',
  'Marinho',
  'Lima',
  'Violeta',
  'Coral',
  'Céu',
  'Dourado',
  'Esmeralda',
  'Lavanda',
  'Âmbar',
  'Ciano',
  'Magenta',
  'Prata',
  'Índigo',
  'Limão',
  'Ametista',
];
export const Avatar = memo(function Avatar({
  index = 0,
  className = '',
}: {
  index?: number;
  className?: string;
}) {
  return (
    <span
      className={`avatar ${className}`}
      role="img"
      aria-label={`Personagem ${palette[index]}`}
      style={{
        backgroundPosition: `${[15.9, 38.95, 61.35, 83.85][index % 4]}% ${Math.floor(index / 4) * 20}%`,
      }}
    />
  );
});
function Brand({ large = false }: { large?: boolean }) {
  return (
    <div className={`brand ${large ? 'brand-large' : ''}`}>
      <span className="brand-character">
        <Avatar index={0} />
      </span>
      <span className="brand-name">
        Impostor<span>TI</span>
      </span>
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal panel"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Fechar">
          <XIcon />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function HowTo({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Como jogar" onClose={onClose}>
      <ol className="instructions">
        <li>
          <strong>Entre no laboratório.</strong> Digite o código da sala, seu nome e escolha um
          personagem.
        </li>
        <li>
          <strong>Confira seu papel em segredo.</strong> Civis recebem uma palavra e uma imagem. O
          impostor recebe apenas a categoria.
        </li>
        <li>
          <strong>Dê uma pista.</strong> Escreva uma dica curta sem dizer a palavra. O impostor
          precisa blefar!
        </li>
        <li>
          <strong>Conversem e votem.</strong> O professor abre a votação. Escolha um suspeito e
          confirme seu voto.
        </li>
        <li>
          <strong>Investiguem até o fim.</strong> Se um civil sair, a partida continua. Civis vencem
          ao eliminar o impostor; o impostor vence quando restar apenas um civil.
        </li>
      </ol>
      <p className="subtle">
        Cada aluno joga individualmente. Quem é eliminado continua assistindo.
      </p>
      <button className="primary full" onClick={onClose}>
        Entendi, vamos jogar <ArrowRightIcon />
      </button>
    </Modal>
  );
}
function AvatarPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="avatar-picker" role="group" aria-label="Escolha seu personagem">
      {palette.map((color, i) => (
        <button
          type="button"
          key={i}
          className={`avatar-option ${value === i ? 'selected' : ''}`}
          aria-label={`Personagem ${color}`}
          aria-pressed={value === i}
          onClick={() => onChange(i)}
        >
          <Avatar index={i} />
        </button>
      ))}
    </div>
  );
}
function Home() {
  const { send, busy, recovering, connected } = useGame();
  const [mode, setMode] = useState<'home' | 'join'>('home');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(0);
  const [help, setHelp] = useState(false);
  const join = (e: FormEvent) => {
    e.preventDefault();
    void send({ type: 'room:join', code: code.toUpperCase().trim(), name, avatar });
  };
  return (
    <main className="home">
      <div className="home-top">
        <span className="eyebrow">
          <span className="tiny-dot" /> APRENDER TAMBÉM É UM JOGO
        </span>
        <button className="ghost" onClick={() => setHelp(true)}>
          <InfoIcon /> Como jogar
        </button>
      </div>
      <div className="home-layout">
        <section className="home-story">
          <span className="eyebrow gold">O LABORATÓRIO TEM UM SEGREDO</span>
          <Brand large />
          <h1>
            Uma palavra.
            <br />
            Muitas pistas.
            <br />
            <span>Um impostor.</span>
          </h1>
          <p>
            Observe as dicas, desconfie dos blefes e descubra quem não sabe do que a turma está
            falando.
          </p>
          <div className="hero-cast">
            <Avatar index={1} />
            <Avatar index={2} />
            <div className="secret-avatar">
              <Avatar index={4} />
              <span>?</span>
            </div>
            <Avatar index={3} />
            <Avatar index={7} />
          </div>
          <div className="home-badges">
            <span>
              <UsersThreeIcon /> Até 24 alunos
            </span>
            <span>
              <MonitorIcon /> No seu navegador
            </span>
            <span>
              <ShieldCheckIcon /> Sem cadastro
            </span>
          </div>
        </section>
        <section className="home-card panel">
          <div className="card-tag">SUA PRÓXIMA MISSÃO</div>
          {mode === 'home' ? (
            <>
              <div className="card-symbol">
                <GameControllerIcon weight="duotone" />
              </div>
              <h2>Quem está blefando?</h2>
              <p>Seu lugar no laboratório está esperando.</p>
              <button className="primary full big" onClick={() => setMode('join')}>
                <PlayIcon weight="fill" /> Jogar <ArrowRightIcon />
              </button>
              <button
                className="secondary full big"
                disabled={busy}
                onClick={() => void send({ type: 'room:create' })}
              >
                <CrownIcon /> {busy ? 'Preparando sua sala…' : 'Sou professor'}
              </button>
              <div className="divider">
                <span>INFORMÁTICA + DEDUÇÃO</span>
              </div>
              <p className="card-note">
                Hardware, programas e os pequenos mistérios do mundo digital.
              </p>
            </>
          ) : (
            <>
              <div className="join-title">
                <button className="icon-button" aria-label="Voltar" onClick={() => setMode('home')}>
                  ←
                </button>
                <h2>Entre para a turma</h2>
              </div>
              <form onSubmit={join}>
                <label>
                  Código da sala
                  <input
                    autoFocus
                    required
                    minLength={6}
                    maxLength={6}
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/[^a-zA-Z2-9]/g, '').toUpperCase())
                    }
                    placeholder="ABC234"
                    className="code-input"
                    autoComplete="off"
                  />
                </label>
                <label>
                  Seu nome
                  <input
                    required
                    minLength={2}
                    maxLength={24}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome e sobrenome"
                    autoComplete="name"
                  />
                </label>
                <div className="label">Escolha seu personagem</div>
                <AvatarPicker value={avatar} onChange={setAvatar} />
                <button className="primary full" disabled={busy}>
                  {busy ? 'Entrando na sala…' : 'Entrar na sala'} <ArrowRightIcon />
                </button>
              </form>
            </>
          )}
          <div className={`connection-note ${connected ? 'online' : ''}`}>
            <span className="tiny-dot" />
            {connected
              ? 'Laboratório conectado'
              : recovering
                ? 'Conectando ao laboratório…'
                : 'Iniciando conexão…'}
          </div>
        </section>
      </div>
      <footer className="home-footer">
        PISTAS NA TELA. IDEIAS EM GRUPO. <span>Impostor TI · Sala de aula</span>
      </footer>
      {help && <HowTo onClose={() => setHelp(false)} />}
    </main>
  );
}
function TeacherSettings() {
  const { room, privateState, send, busy } = useGame();
  const [settings, setSettings] = useState<Settings>(room!.settings);
  const [manual, setManual] = useState(
    privateState?.kind === 'teacher' ? privateState.manualImpostorId : null,
  );
  useEffect(() => {
    setSettings(room!.settings);
    if (privateState?.kind === 'teacher') setManual(privateState.manualImpostorId);
  }, [room!.settings, privateState]);
  const save = (e: FormEvent) => {
    e.preventDefault();
    void send({ type: 'teacher:settings', settings, manualImpostorId: manual });
  };
  return (
    <form className="settings" onSubmit={save}>
      <h2>
        <GearIcon /> Prepare a investigação
      </h2>
      <fieldset>
        <legend>Categorias da partida</legend>
        {CATEGORIES.map((category) => (
          <label className="check-label" key={category}>
            <input
              type="checkbox"
              checked={settings.categories.includes(category)}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  categories: e.target.checked
                    ? [...settings.categories, category]
                    : settings.categories.filter((c) => c !== category),
                })
              }
            />
            {category}
          </label>
        ))}
      </fieldset>
      <label>
        Tempo para cada dica
        <select
          value={settings.clueSeconds}
          onChange={(e) => setSettings({ ...settings, clueSeconds: Number(e.target.value) })}
        >
          {[30, 45, 60, 90, 120, 180, 300].map((n) => (
            <option key={n} value={n}>
              {n} segundos
            </option>
          ))}
        </select>
      </label>
      <label>
        Quem será o impostor?
        <select
          value={settings.selectionMode}
          onChange={(e) =>
            setSettings({ ...settings, selectionMode: e.target.value as Settings['selectionMode'] })
          }
        >
          <option value="random">Sortear automaticamente</option>
          <option value="manual">Escolher em segredo</option>
        </select>
      </label>
      {settings.selectionMode === 'manual' && (
        <label>
          Impostor escolhido
          <select value={manual ?? ''} onChange={(e) => setManual(e.target.value || null)}>
            <option value="">Selecione um aluno</option>
            {room!.players
              .filter((p) => !p.spectator)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
      )}
      <label className="check-label">
        <input
          type="checkbox"
          checked={settings.allowSpectators}
          onChange={(e) => setSettings({ ...settings, allowSpectators: e.target.checked })}
        />{' '}
        Permitir espectadores após o início
      </label>
      <button className="secondary full" disabled={busy || !settings.categories.length}>
        <CheckIcon /> Salvar configurações
      </button>
    </form>
  );
}
function Lobby() {
  const { room, privateState, send, busy } = useGame();
  const teacher = privateState?.kind === 'teacher';
  const me = room!.players.find(
    (p) => privateState?.kind === 'player' && p.id === privateState.playerId,
  );
  const [avatar, setAvatar] = useState(me?.avatar ?? 0);
  const [copied, setCopied] = useState(false);
  const ready = room!.players.filter((p) => p.ready && !p.spectator).length;
  const participants = room!.players.filter((p) => !p.spectator);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room!.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <main className="lobby-layout">
      <section className="panel lobby-main">
        <div className="lobby-heading">
          <div>
            <span className="eyebrow gold">O LABORATÓRIO ESTÁ ABERTO</span>
            <h1>Reúna sua turma.</h1>
            <p>Uma boa investigação começa com todo mundo por aqui.</p>
          </div>
          <div className="room-code-box">
            <span>CÓDIGO DA SALA</span>
            <button onClick={() => void copy()} title="Copiar código">
              {room!.code} {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
        </div>
        <div className="roster-heading">
          <h2>
            <UsersThreeIcon /> Investigadores <span>{participants.length}/24</span>
          </h2>
          <span className="subtle">{ready} prontos para jogar</span>
        </div>
        <div className="lobby-roster">
          {Array.from({ length: 24 }, (_, i) => {
            const p = participants[i];
            return p ? (
              <div className={`lobby-player ${p.ready ? 'is-ready' : ''}`} key={p.id}>
                <Avatar index={p.avatar} />
                <div>
                  <strong title={p.name}>{p.name}</strong>
                  <span>
                    <i className={`status-dot ${p.online ? 'online' : ''}`} />
                    {!p.online ? 'Desconectado' : p.ready ? 'Pronto!' : 'Escolhendo personagem'}
                  </span>
                </div>
                {teacher ? (
                  <button
                    className="icon-button remove-button"
                    aria-label={`Remover ${p.name}`}
                    onClick={() => void send({ type: 'teacher:remove', playerId: p.id })}
                  >
                    <XIcon />
                  </button>
                ) : p.ready ? (
                  <CheckIcon className="ready-check" />
                ) : null}
              </div>
            ) : (
              <div className="empty-seat" key={`empty${i}`}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <span>Aguardando aluno</span>
              </div>
            );
          })}
        </div>
        {room!.players.some((p) => p.spectator) && (
          <p className="subtle">
            {room!.players.filter((p) => p.spectator).length} espectadores aguardando uma vaga.
          </p>
        )}
      </section>
      <aside className="panel lobby-sidebar">
        {teacher ? (
          <>
            <TeacherSettings />
            <button
              className="primary full big"
              disabled={
                busy || participants.length < 3 || participants.some((p) => !p.ready || !p.online)
              }
              onClick={() => void send({ type: 'game:start' })}
            >
              <PlayIcon weight="fill" /> Iniciar partida
            </button>
            <p className="subtle centered">Pelo menos 3 alunos, todos conectados e prontos.</p>
            <a
              className="ghost full"
              href={`#/telao/${room!.code}`}
              target="_blank"
              rel="noreferrer"
            >
              <MonitorIcon /> Abrir telão para a turma
            </a>
          </>
        ) : (
          <>
            <div className="profile-preview">
              <Avatar index={avatar} />
              <h2>{me?.name}</h2>
              <span className="pill">{me?.spectator ? 'Espectador' : 'Seu personagem'}</span>
            </div>
            {!me?.spectator && (
              <>
                <AvatarPicker value={avatar} onChange={setAvatar} />
                <button
                  className={`full big ${me?.ready ? 'secondary' : 'primary'}`}
                  disabled={busy}
                  onClick={() => void send({ type: 'player:ready', ready: !me?.ready, avatar })}
                >
                  {me?.ready ? (
                    <>
                      <CheckIcon /> Estou pronto!
                    </>
                  ) : (
                    <>
                      Estou pronto <ArrowRightIcon />
                    </>
                  )}
                </button>
                <p className="subtle centered">
                  {me?.ready
                    ? 'Aguarde o professor iniciar a partida.'
                    : 'Escolha seu personagem e avise que está pronto.'}
                </p>
              </>
            )}
            {me?.spectator && (
              <p className="subtle centered">
                Você está assistindo. O professor pode liberar uma vaga na próxima partida.
              </p>
            )}
          </>
        )}
      </aside>
    </main>
  );
}
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
      aria-label={selectable ? `Votar em ${player.name}` : player.name}
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
function GameBoard() {
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
export function App() {
  const { room, privateState, error, clearError, connected, recovering, leave } = useGame();
  const navigate = useNavigate();
  const route = useLocation();
  const [help, setHelp] = useState(false);
  const isDisplay = route.pathname.startsWith('/telao/');
  useEffect(() => {
    if (room && !isDisplay && route.pathname !== `/sala/${room.code}`)
      navigate(`/sala/${room.code}`, { replace: true });
  }, [room?.code, isDisplay, route.pathname, navigate]);
  const exit = () => {
    leave();
    navigate('/');
  };
  return (
    <div className={`app-shell ${room ? 'in-room' : ''} ${isDisplay ? 'display-mode' : ''}`}>
      <div className="scene" />
      <div className="scene-shade" />
      {room ? (
        <>
          <header className="game-header">
            <Brand />
            <span className="header-subtitle">
              Jogo de dedução social
              <br />
              para a sala de aula
            </span>
            <div className="header-room">
              <span>SALA</span>
              <strong>{room.code}</strong>
            </div>
            <div className="teacher-status">
              <Avatar index={8} />
              <div>
                <strong>
                  <i className={`status-dot ${room.teacherOnline ? 'online' : ''}`} />
                  {room.teacherOnline ? 'Professor conectado' : 'Professor desconectado'}
                </strong>
                <span>
                  {room.phase === 'LOBBY'
                    ? 'Preparando a investigação'
                    : room.phase === 'CLUES'
                      ? 'Aguardando as dicas da turma'
                      : room.phase === 'VOTING'
                        ? 'Acompanhando os votos secretos'
                        : 'No controle da investigação'}
                </span>
              </div>
            </div>
            <button className="icon-button" aria-label="Como jogar" onClick={() => setHelp(true)}>
              <InfoIcon />
            </button>
            {isDisplay ? (
              <button
                className="icon-button"
                aria-label="Tela cheia"
                onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else void document.documentElement.requestFullscreen();
                }}
              >
                <ArrowsOutIcon />
              </button>
            ) : (
              <button className="icon-button" aria-label="Sair da sala" onClick={exit}>
                <DoorOpenIcon />
              </button>
            )}
          </header>
          {(!connected || recovering) && (
            <div className="reconnect-banner" role="status">
              <WifiHighIcon /> Reconectando… sua vaga e suas respostas serão preservadas.
            </div>
          )}
          {room.phase === 'LOBBY' ? (
            isDisplay ? (
              <div className="display-lobby panel">
                <span className="eyebrow gold">ENTRE NO LABORATÓRIO</span>
                <h1>{room.code}</h1>
                <p>Digite o código no seu dispositivo e escolha seu personagem.</p>
                <div className="display-avatars">
                  {room.players.map((p) => (
                    <div key={p.id}>
                      <Avatar index={p.avatar} />
                      <strong>{p.name}</strong>
                    </div>
                  ))}
                </div>
                <span className="subtle">
                  {room.players.length}/24 investigadores · aguardando o professor
                </span>
              </div>
            ) : (
              <Lobby />
            )
          ) : (
            <GameBoard />
          )}
          <footer className="game-footer">
            <span>
              <span className="tiny-dot" />
              {privateState?.kind === 'teacher'
                ? 'PAINEL PRIVADO DO PROFESSOR'
                : isDisplay
                  ? 'TELÃO PÚBLICO · SEM SEGREDOS EXPOSTOS'
                  : 'SUA IDENTIDADE É SECRETA. SUAS PISTAS, NEM TANTO.'}
            </span>
            <span>IMPOSTOR TI · RESPEITO FAZ PARTE DO JOGO</span>
          </footer>
        </>
      ) : isDisplay ? (
        <main className="loading-display panel">
          <MonitorIcon />
          <h1>Conectando o telão…</h1>
          <p>{error || 'O laboratório pode levar um momento para iniciar.'}</p>
          <a className="secondary" href="#/">
            Voltar ao início
          </a>
        </main>
      ) : (
        <Home />
      )}
      {error && (
        <div className="toast" role="alert">
          <InfoIcon />
          <span>{error}</span>
          <button className="icon-button" aria-label="Fechar mensagem" onClick={clearError}>
            <XIcon />
          </button>
        </div>
      )}
      {help && <HowTo onClose={() => setHelp(false)} />}
    </div>
  );
}
