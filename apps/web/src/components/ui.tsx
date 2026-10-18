import { memo, useEffect, useRef, type ReactNode } from 'react';
import { ArrowRightIcon, InfoIcon, XIcon } from '@phosphor-icons/react';
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;
const palette = [
  'Vermelho',
  'Azul',
  'Verde',
  'Amarelo',
  'Laranja',
  'Roxo',
  'Turquesa',
  'Rosa',
  'Branco',
  'Vermelho',
  'Azul',
  'Verde',
  'Amarelo',
  'Laranja',
  'Roxo',
  'Turquesa',
  'Rosa',
  'Branco',
  'Vermelho',
  'Azul',
  'Verde',
  'Amarelo',
  'Laranja',
  'Roxo',
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
      aria-label={`Personagem ${palette[index]} ${String(index + 1).padStart(2, '0')}`}
      style={{
        backgroundPosition: `${[15.9, 38.95, 61.35, 83.85][index % 4]}% ${Math.floor(index / 4) * 20}%`,
      }}
    />
  );
});
export function Brand({ large = false }: { large?: boolean }) {
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
export function Modal({
  title,
  children,
  onClose,
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal panel ${className}`}
      aria-label={title}
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
export function HowTo({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Como jogar" onClose={onClose}>
      <ol className="instructions">
        <li>
          <strong>Entre no laboratório.</strong> Digite o código da sala, seu nome e escolha um
          personagem.
        </li>
        <li>
          <strong>Confira seu papel em segredo.</strong> Civis recebem uma palavra e uma imagem. O
          impostor recebe apenas a categoria e identifica seus aliados, quando houver.
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
          ao eliminar todos os impostores. Impostores vencem quando igualam ou superam os civis
          vivos.
        </li>
      </ol>
      <p>
        Escolha três poderes no lobby. Use apenas um por rodada. A recarga normal é de quatro
        rodadas; poderes recebidos pela Caixa de Pandora recarregam em duas. Égide do Destino só
        pode ser ativada uma vez por partida.
      </p>
      <p className="subtle">
        Você também pode pular o voto: sua resposta será confirmada sem votar em ninguém. Cada aluno
        joga individualmente. Quem é eliminado continua assistindo.
      </p>
      <button className="primary full" onClick={onClose}>
        Entendi, vamos jogar <ArrowRightIcon />
      </button>
    </Modal>
  );
}
export function AvatarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="avatar-picker" role="group" aria-label="Escolha seu personagem">
      {palette.map((color, i) => (
        <button
          type="button"
          key={i}
          className={`avatar-option ${value === i ? 'selected' : ''}`}
          aria-label={`Personagem ${color} ${String(i + 1).padStart(2, '0')}`}
          aria-pressed={value === i}
          onClick={() => onChange(i)}
        >
          <Avatar index={i} />
        </button>
      ))}
    </div>
  );
}
