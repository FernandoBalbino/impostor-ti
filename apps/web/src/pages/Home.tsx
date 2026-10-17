import { useState, type FormEvent } from 'react';
import { useGame } from '../connection';
import { Avatar, Brand, HowTo, AvatarPicker } from '../components/ui';
import {
  ArrowRightIcon,
  CrownIcon,
  GameControllerIcon,
  InfoIcon,
  MonitorIcon,
  PlayIcon,
  ShieldCheckIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
export function Home() {
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
