import { useEffect, useState, type ReactNode } from 'react';
import {
  ACTIVE_POWER_PHASES,
  POWER_IDS,
  POWERS,
  type PowerId,
  type PowerNotice,
  type PowerSlot,
  type PublicRoom,
} from '@impostor/shared';
import { CheckIcon, LightningIcon, ShieldCheckIcon, XIcon } from '@phosphor-icons/react';
import { useGame } from '../connection';
import { asset, Modal } from './ui';

function PowerIcon({ id }: { id: PowerId }) {
  return (
    <img src={asset(`assets/powers/${id}.webp`)} alt="" draggable={false} width={64} height={64} />
  );
}
function Tooltip({ id, children }: { id: PowerId; children?: ReactNode }) {
  const p = POWERS[id];
  return (
    <span className="power-tooltip" role="tooltip">
      <strong>{p.name}</strong>
      <span>{p.description}</span>
      <small>
        {p.window === 'clues' ? 'Durante o prazo normal das dicas' : 'Dicas, conversa e votação'} ·{' '}
        {p.once ? 'Uso único na partida' : 'Recarga: 4 rodadas'}
      </small>
      {children}
    </span>
  );
}
export function PowerPicker({
  value,
  onChange,
  disabled,
}: {
  value: PowerId[];
  onChange: (value: PowerId[]) => void;
  disabled: boolean;
}) {
  const [detail, setDetail] = useState<PowerId | null>(null);
  const toggle = (id: PowerId) => {
    if (value.includes(id)) onChange(value.filter((p) => p !== id));
    else if (value.length < 2) onChange([...value, id]);
  };
  return (
    <section className="power-picker" aria-label="Escolha seus poderes">
      <div className="power-picker-heading">
        <span>
          <LightningIcon weight="fill" /> Escolha dois poderes
        </span>
        <strong>{value.length}/2 poderes</strong>
      </div>
      <div className="power-grid">
        {POWER_IDS.map((id) => (
          <div className="power-option-wrap" key={id}>
            <button
              type="button"
              className={`power-icon ${value.includes(id) ? 'equipped' : ''}`}
              aria-label={POWERS[id].name}
              aria-pressed={value.includes(id)}
              disabled={disabled}
              onClick={() => setDetail(id)}
            >
              <PowerIcon id={id} />
              {value.includes(id) && <CheckIcon className="power-selected" />}
            </button>
            <Tooltip id={id} />
          </div>
        ))}
      </div>
      {detail && (
        <Modal title={POWERS[detail].name} onClose={() => setDetail(null)}>
          <div className="power-detail-icon">
            <PowerIcon id={detail} />
          </div>
          <p>{POWERS[detail].description}</p>
          <p className="subtle">
            {POWERS[detail].window === 'clues'
              ? 'Ative durante o prazo normal das dicas.'
              : 'Ative nas etapas de dicas, conversa ou votação.'}{' '}
            {POWERS[detail].once ? 'Uma vez por partida.' : 'Volta quatro rodadas após o uso.'}
          </p>
          {value.length === 2 && !value.includes(detail) && (
            <p className="power-warning">
              Desmarque um dos dois poderes escolhidos para selecionar este.
            </p>
          )}
          <button
            type="button"
            className="primary full"
            disabled={disabled || (value.length === 2 && !value.includes(detail))}
            onClick={() => {
              toggle(detail);
              setDetail(null);
            }}
          >
            {value.includes(detail) ? 'Desmarcar poder' : 'Escolher poder'}
          </button>
        </Modal>
      )}
    </section>
  );
}

function unavailable(
  room: PublicRoom,
  slot: PowerSlot,
  usedRound: number,
  connected: boolean,
  now: number,
) {
  if (!connected) return 'Aguarde a conexão ser restabelecida.';
  if (POWERS[slot.id].once && slot.used) return 'Este poder já foi usado nesta partida.';
  if (slot.readyRound > room.round) return `Disponível na rodada ${slot.readyRound}.`;
  if (usedRound === room.round) return 'Você já ativou um poder nesta rodada.';
  if (!ACTIVE_POWER_PHASES.includes(room.phase))
    return 'Aguarde uma etapa de dicas, conversa ou votação.';
  if (
    POWERS[slot.id].window === 'clues' &&
    (room.phase !== 'CLUES' || now >= (room.clueDeadline ?? 0))
  )
    return 'Disponível somente durante o prazo normal das dicas.';
  return '';
}
export function PowerTray({ now }: { now: number }) {
  const { room, privateState, connected, send, busy, error, clearError } = useGame();
  const [selected, setSelected] = useState<PowerId | null>(null);
  const [target, setTarget] = useState('');
  const [text, setText] = useState('');
  if (privateState?.kind !== 'player' || !room) return null;
  const state = privateState;
  const me = room.players.find((p) => p.id === state.playerId);
  if (!me?.alive || me.spectator) return null;
  const slot = state.powers.find((p) => p.id === selected);
  const reason = slot ? unavailable(room, slot, state.usedPowerRound, connected, now) : '';
  const def = selected ? POWERS[selected] : null;
  const effects = state.effects;
  const notices: string[] = [];
  if (effects.silencedUntil > now && room.phase === 'CLUES')
    notices.push(`Silenciado · ${Math.ceil((effects.silencedUntil - now) / 1000)}s`);
  if (effects.forbiddenLetter) notices.push(`Próxima dica: sem ${effects.forbiddenLetter}`);
  if (effects.bannedVoteRound === room.round) notices.push('Sem voto nesta rodada');
  if (effects.doubleVoteRound === room.round) notices.push('Seu voto vale ×2');
  if (effects.aegis) notices.push('Escudo contra eliminação');
  if (effects.refuge) notices.push('Barreira contra poderes');
  if (effects.hiddenImageRounds.includes(room.round)) notices.push('Imagem oculta nesta rodada');
  if (
    room.phase === 'CLUES' &&
    !state.clueSubmitted &&
    state.clueDeadline &&
    state.clueDeadline !== room.clueDeadline
  )
    notices.push(
      state.clueDeadline > now
        ? `Reenvio · ${Math.ceil((state.clueDeadline - now) / 1000)}s`
        : 'Prazo de reenvio encerrado',
    );
  return (
    <>
      <div className="power-tray" aria-label="Seus poderes">
        <span className="power-tray-label">
          <LightningIcon weight="fill" /> SEUS PODERES
        </span>
        <div className="equipped-powers">
          {state.powers.map((p) => {
            const why = unavailable(room, p, state.usedPowerRound, connected, now);
            const spent = !!POWERS[p.id].once && p.used;
            const count = Math.max(0, p.readyRound - room.round);
            const recent = state.notifications.at(-1);
            return (
              <div className="power-option-wrap" key={p.id}>
                <button
                  type="button"
                  className={`power-icon ${why ? 'unavailable' : 'available'} ${recent?.powerId === p.id ? 'power-flash' : ''}`}
                  key={`${p.id}-${recent?.id ?? 0}`}
                  aria-label={`${POWERS[p.id].name}${why ? ', indisponível' : ', disponível'}`}
                  aria-disabled={!!why}
                  onClick={() => {
                    clearError();
                    setSelected(p.id);
                    setTarget(POWERS[p.id].target === 'self' ? me.id : '');
                    setText('');
                  }}
                >
                  <PowerIcon id={p.id} />
                  {spent ? (
                    <span className="power-counter spent">Usado</span>
                  ) : count > 0 ? (
                    <span className="power-counter">{count}</span>
                  ) : (
                    why && <span className="power-lock">•</span>
                  )}
                </button>
                <Tooltip id={p.id}>
                  <b>{why || 'Disponível · um poder por rodada'}</b>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </div>
      {notices.length > 0 && (
        <div className="effect-chips" aria-live="polite">
          {notices.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      {selected && def && slot && (
        <Modal title={def.name} onClose={() => setSelected(null)}>
          <div className="power-detail-icon">
            <PowerIcon id={selected} />
          </div>
          <p>{def.description}</p>
          <p className="subtle">
            {def.once
              ? 'Uma ativação nesta partida.'
              : 'Após ativar, este poder volta na rodada ' + (room.round + 4) + '.'}{' '}
            Só um poder por rodada.
          </p>
          {error && (
            <p className="power-warning" role="alert">
              {error}
            </p>
          )}
          {reason ? (
            <p className="power-warning">{reason}</p>
          ) : (
            <>
              {def.target !== 'self' && (
                <label>
                  Escolha quem receberá o poder
                  <select
                    aria-label="Alvo do poder"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  >
                    <option value="">Selecione um jogador</option>
                    {room.players
                      .filter(
                        (p) => p.alive && !p.spectator && (def.target === 'any' || p.id !== me.id),
                      )
                      .map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.name}
                          {p.id === me.id ? ' (você)' : ''}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {selected === 'echo' && (
                <label>
                  Dica falsa
                  <textarea
                    aria-label="Dica falsa"
                    maxLength={80}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Escreva a dica que aparecerá no nome do alvo…"
                  />
                  <small>{Array.from(text).length}/80</small>
                </label>
              )}
            </>
          )}
          <div className="dialog-actions">
            <button className="secondary" type="button" onClick={() => setSelected(null)}>
              Cancelar
            </button>
            <button
              className="primary"
              type="button"
              disabled={busy || !!reason || !target || (selected === 'echo' && !text.trim())}
              onClick={() =>
                void send({
                  type: 'power:activate',
                  powerId: selected,
                  ...(def.target !== 'self' ? { targetId: target } : {}),
                  ...(selected === 'echo' ? { text } : {}),
                }).then((ok) => {
                  if (ok) setSelected(null);
                })
              }
            >
              <LightningIcon weight="fill" /> Ativar poder
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function PowerNotifications() {
  const { room, privateState } = useGame();
  const [queue, setQueue] = useState<PowerNotice[]>([]);
  const player = privateState?.kind === 'player' ? privateState : null;
  const key = room && player ? `impostor-ti.notices.${room.code}.${player.playerId}` : '';
  useEffect(() => {
    if (!key || !player) return;
    const seen = Number(sessionStorage.getItem(key) ?? 0);
    const fresh = player.notifications.filter((n) => n.id > seen);
    if (!fresh.length) return;
    sessionStorage.setItem(key, String(fresh.at(-1)!.id));
    setQueue((old) => [...old, ...fresh].slice(-32));
  }, [key, player?.notifications]);
  useEffect(() => {
    if (!queue.length) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), 6500);
    return () => clearTimeout(timer);
  }, [queue[0]?.id]);
  const notice = queue[0];
  if (!notice || !player || !room) return null;
  return (
    <aside
      className={`power-notice ${notice.tone}`}
      key={`${key}-${notice.id}`}
      role="status"
      aria-live="polite"
    >
      <div className="notice-sprite">
        <PowerIcon id={notice.powerId} />
      </div>
      <div>
        <strong>{notice.title}</strong>
        <p>{notice.message}</p>
        {queue.length > 1 && <small>Mais {queue.length - 1} aviso(s)</small>}
      </div>
      <button
        type="button"
        className="icon-button"
        aria-label="Fechar aviso do poder"
        onClick={() => setQueue((q) => q.slice(1))}
      >
        <XIcon />
      </button>
      <ShieldCheckIcon className="notice-spark" aria-hidden="true" />
    </aside>
  );
}
