import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ACTIVE_POWER_PHASES,
  POWER_IDS,
  LOADOUT_SIZE,
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
const windowLabel = (id: PowerId) =>
  id === 'chosen'
    ? 'Antes de abrir a votação ou o desempate'
    : id === 'all_or_nothing'
      ? 'Prazo normal das dicas e conversa'
      : POWERS[id].window === 'clues'
        ? 'Durante o prazo normal das dicas'
        : 'Dicas, conversa e votação';
function Tooltip({
  id,
  children,
  cooldown = 4,
}: {
  id: PowerId;
  children?: ReactNode;
  cooldown?: number;
}) {
  const p = POWERS[id];
  return (
    <span className="power-tooltip" role="tooltip">
      <strong>{p.name}</strong>
      {p.exclusive && <b className="exclusive-label">Exclusivo do impostor · automático</b>}
      <span>{p.description}</span>
      <small>
        {windowLabel(id)} · {p.once ? 'Uso único na partida' : 'Recarga: ' + cooldown + ' rodadas'}
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
    else if (value.length < LOADOUT_SIZE) onChange([...value, id]);
  };
  return (
    <section className="power-picker" aria-label="Escolha seus poderes">
      <div className="power-picker-heading">
        <span>
          <LightningIcon weight="fill" /> Escolha três poderes
        </span>
        <strong>{value.length}/3 poderes</strong>
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
        <Modal className="power-dialog" title={POWERS[detail].name} onClose={() => setDetail(null)}>
          <div className="power-detail-icon">
            <PowerIcon id={detail} />
          </div>
          <p>{POWERS[detail].description}</p>
          <p className="subtle">
            {windowLabel(detail) + '.'}{' '}
            {POWERS[detail].once ? 'Uma vez por partida.' : 'Volta quatro rodadas após o uso.'}
          </p>
          {value.length === LOADOUT_SIZE && !value.includes(detail) && (
            <p className="power-warning">
              Desmarque um dos três poderes escolhidos para selecionar este.
            </p>
          )}
          <button
            type="button"
            className="primary full"
            disabled={disabled || (value.length === LOADOUT_SIZE && !value.includes(detail))}
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
  if (slot.pendingRound) return 'Transformação agendada para a rodada ' + slot.pendingRound + '.';
  if ((slot.blockedUntilRound ?? 0) >= room.round && !!slot.blockedUntilRound)
    return 'Suspenso até a rodada ' + (slot.blockedUntilRound! + 1) + '.';
  if (slot.id === 'chosen' && room.phase === 'VOTING') return 'Ative antes de abrir a votação.';
  if (
    slot.id === 'all_or_nothing' &&
    room.phase !== 'WAITING_FOR_VOTE' &&
    !(room.phase === 'CLUES' && now < (room.clueDeadline ?? 0))
  )
    return 'Agende antes da primeira votação, nas dicas ou conversa.';
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
  const slots = [
    ...state.powers,
    ...(state.role === 'impostor' && state.exclusivePower ? [state.exclusivePower] : []),
  ];
  const slot = slots.find((p) => p.id === selected);
  const reason = slot ? unavailable(room, slot, state.usedPowerRound, connected, now) : '';
  const def = selected ? POWERS[selected] : null;
  const effects = state.effects;
  const notices: string[] = [];
  if (state.role === 'impostor' && state.vestigeLetter)
    notices.push(`Vestígio do Invisível · primeira letra: ${state.vestigeLetter}`);
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
  if (effects.labyrinthWords.length)
    notices.push('Inclua na próxima dica: ' + effects.labyrinthWords.join(' / '));
  if (effects.dice?.round === room.round)
    notices.push(
      'Seu voto vale ' + effects.dice.value + (effects.doubleVoteRound === room.round ? ' ×2' : ''),
    );
  if (effects.blindRound === room.round) notices.push('Dicas dos outros ocultas nesta rodada');
  if (effects.chosenRound === room.round) notices.push('Você não pode receber votos nesta rodada');
  if (effects.confusion?.round === room.round) notices.push('Nomes embaralhados durante a votação');
  return (
    <>
      <div className="power-tray" aria-label="Seus poderes">
        <span className="power-tray-label">
          <LightningIcon weight="fill" /> SEUS PODERES
        </span>
        <div className="equipped-powers">
          {slots.map((p) => {
            const why = unavailable(room, p, state.usedPowerRound, connected, now);
            const spent = !!POWERS[p.id].once && p.used;
            const suspended = Math.max(0, (p.blockedUntilRound ?? -1) - room.round + 1);
            const count = Math.max(0, p.readyRound - room.round);
            const recent = state.notifications.at(-1);
            return (
              <div className="power-option-wrap" key={p.id}>
                <button
                  type="button"
                  className={`power-icon ${POWERS[p.id].exclusive ? 'exclusive-power' : ''} ${why ? 'unavailable' : 'available'} ${recent?.powerId === p.id ? 'power-flash' : ''}`}
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
                  {POWERS[p.id].exclusive && (
                    <span className="power-exclusive-mark" aria-hidden="true">
                      I
                    </span>
                  )}
                  {suspended > 0 ? (
                    <span className="power-counter">{suspended}</span>
                  ) : p.pendingRound ? (
                    <span className="power-counter spent">Em breve</span>
                  ) : spent ? (
                    <span className="power-counter spent">Usado</span>
                  ) : count > 0 ? (
                    <span className="power-counter">{count}</span>
                  ) : (
                    why && <span className="power-lock">•</span>
                  )}
                </button>
                <Tooltip id={p.id} cooldown={p.cooldown ?? 4}>
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
        <Modal className="power-dialog" title={def.name} onClose={() => setSelected(null)}>
          <div className="power-detail-icon">
            <PowerIcon id={selected} />
          </div>
          <p>{def.description}</p>
          {def.exclusive && (
            <p className="exclusive-label">
              Recebido automaticamente por ser impostor. A pista é privada.
            </p>
          )}
          <p className="subtle">
            {selected === 'pandora'
              ? 'Na rodada ' +
                (room.round + 1) +
                ', esta caixa será substituída por um poder com recarga de duas rodadas.'
              : def.once
                ? 'Uma ativação nesta partida.'
                : 'Após ativar, este poder volta na rodada ' +
                  (room.round + (slot.cooldown ?? 4)) +
                  '.'}{' '}
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
                        (p) =>
                          p.alive &&
                          !p.spectator &&
                          (def.target === 'any' || p.id !== me.id) &&
                          (!['dice', 'ban_vote'].includes(selected!) ||
                            room.phase !== 'VOTING' ||
                            !p.voted) &&
                          (selected !== 'chosen' || !room.immuneIds.includes(p.id)),
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
  const queued = useRef({ key: '', lastId: 0 });
  const player = privateState?.kind === 'player' ? privateState : null;
  const key = room && player ? `impostor-ti.notices.${room.code}.${player.playerId}` : '';
  useEffect(() => {
    if (!key || !player) return;
    if (queued.current.key !== key) {
      queued.current = { key, lastId: Number(sessionStorage.getItem(key) ?? 0) };
      setQueue([]);
    }
    const fresh = player.notifications.filter((n) => n.id > queued.current.lastId);
    if (!fresh.length) return;
    queued.current.lastId = fresh.at(-1)!.id;
    setQueue((old) => [...old, ...fresh].slice(-32));
  }, [key, player?.notifications]);
  useEffect(() => {
    if (key && queue[0]) sessionStorage.setItem(key, String(queue[0].id));
  }, [key, queue[0]?.id]);
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
