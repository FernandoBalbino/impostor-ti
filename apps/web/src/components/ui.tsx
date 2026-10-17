import { memo, useEffect, useRef, type ReactNode } from 'react';
import { ArrowRightIcon, InfoIcon, XIcon } from '@phosphor-icons/react';
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;
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
