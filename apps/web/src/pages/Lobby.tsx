import { useState, useEffect, type FormEvent } from 'react';
import { useGame } from '../connection';
import { CATEGORIES, type Settings } from '@impostor/shared';
import { Avatar, AvatarPicker } from '../components/ui';
import {
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  GearIcon,
  MonitorIcon,
  PlayIcon,
  UsersThreeIcon,
  XIcon,
} from '@phosphor-icons/react';
function TeacherSettings({ onDirty }: { onDirty: (dirty: boolean) => void }) {
  const { room, privateState, send, busy } = useGame();
  const [settings, setSettings] = useState<Settings>(room!.settings);
  const [manual, setManual] = useState(
    privateState?.kind === 'teacher' ? privateState.manualImpostorId : null,
  );
  const dirty =
    JSON.stringify(settings) !== JSON.stringify(room!.settings) ||
    manual !== (privateState?.kind === 'teacher' ? privateState.manualImpostorId : null);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
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
export function Lobby() {
  const { room, privateState, send, busy } = useGame();
  const teacher = privateState?.kind === 'teacher';
  const me = room!.players.find(
    (p) => privateState?.kind === 'player' && p.id === privateState.playerId,
  );
  const [avatar, setAvatar] = useState(me?.avatar ?? 0);
  const [copied, setCopied] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const ready = room!.players.filter((p) => p.ready && !p.spectator).length;
  const participants = room!.players.filter((p) => !p.spectator);
  const validManualChoice =
    room!.settings.selectionMode !== 'manual' ||
    (privateState?.kind === 'teacher' &&
      participants.some((p) => p.id === privateState.manualImpostorId));
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
            <TeacherSettings onDirty={setSettingsDirty} />
            <button
              className="primary full big"
              disabled={
                busy ||
                settingsDirty ||
                !validManualChoice ||
                participants.length < 3 ||
                participants.some((p) => !p.ready || !p.online)
              }
              onClick={() => void send({ type: 'game:start' })}
            >
              <PlayIcon weight="fill" /> Iniciar partida
            </button>
            <p className="subtle centered">
              {settingsDirty
                ? 'Salve as configurações antes de iniciar.'
                : !validManualChoice
                  ? 'Escolha e salve um impostor antes de iniciar.'
                  : 'Pelo menos 3 alunos, todos conectados e prontos.'}
            </p>
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
                <AvatarPicker
                  value={avatar}
                  onChange={(value) => {
                    setAvatar(value);
                    void send({ type: 'player:ready', ready: false, avatar: value });
                  }}
                />
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
