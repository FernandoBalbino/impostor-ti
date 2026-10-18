import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGame } from './connection';
import { Avatar, HowTo } from './components/ui';
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
  const { room, error, clearError, connected, recovering, leave } = useGame();
  const navigate = useNavigate();
  const route = useLocation();
  const [help, setHelp] = useState(false);
  const isDisplay = route.pathname.startsWith('/telao/');
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [room?.phase, room?.code]);
  useEffect(() => {
    if (room && !isDisplay && route.pathname !== `/sala/${room.code}`)
      navigate(`/sala/${room.code}`, { replace: true });
  }, [room?.code, isDisplay, route.pathname, navigate]);
  const exit = () => {
    leave();
    navigate('/');
  };
  const roomTools = (
    <nav className="room-tools" aria-label="Opções da sala">
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
    </nav>
  );
  return (
    <div className={`app-shell ${room ? 'in-room' : ''} ${isDisplay ? 'display-mode' : ''}`}>
      <div className="scene" />
      <div className="scene-shade" />
      {room ? (
        <>
          {room.phase === 'LOBBY' && roomTools}
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
            <GameBoard tools={roomTools} />
          )}
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
