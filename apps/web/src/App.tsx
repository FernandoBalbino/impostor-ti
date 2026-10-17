import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGame } from './connection';
import { Avatar, Brand, HowTo } from './components/ui';
import { Home } from './pages/Home';
import { Lobby } from './pages/Lobby';
import { GameBoard } from './pages/Board';
import {
  ArrowsOutIcon,
  DoorOpenIcon,
  InfoIcon,
  MonitorIcon,
  WifiHighIcon,
  XIcon,
} from '@phosphor-icons/react';
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
