# Recursos visuais

## Poderes estratégicos

Dez sprites originais foram gerados individualmente com a ferramenta integrada Image Gen em 18/10/2026, seguindo a pixel art do jogo. Fontes PNG em `docs/power-sprites/`; sprites de jogo em WebP sem perdas, com transparência e 128×128 pixels, em `apps/web/public/assets/powers/`. As dez versões otimizadas somam 135.704 bytes. Prompts e assuntos individuais estão em [IMAGE-PROMPTS.md](IMAGE-PROMPTS.md).

## Imagens reutilizadas

Equipamentos e parte dos ícones foram copiados do repositório do usuário [FernandoBalbino/CentralJogos](https://github.com/FernandoBalbino/CentralJogos), principalmente `assets/items/` e os ícones do organizador de arquivos. A reutilização foi solicitada pelo proprietário do projeto. Os direitos dos recursos de terceiros permanecem com seus respectivos titulares; as marcas identificam os programas ensinados.

## Ícones

- Phosphor Icons, licença MIT, com cópia em `apps/web/public/assets/PHOSPHOR-LICENSE.txt`. Ícones de interface e pictogramas de conceitos básicos. As formas são do pacote oficial, sem desenhos vetoriais substitutos.
- Font Awesome Free Brands, com licença em `apps/web/public/assets/FONT-AWESOME-LICENSE.txt`. Logos de Edge, Opera, Brave, Safari, Linux, Android e Apple. Windows, Ubuntu, Chrome e Firefox reutilizam os recursos do CentralJogos.
- Os scripts `assets.mjs` e `vendor-icons.mjs` registram a origem e a montagem dos arquivos. Não são necessários para executar ou compilar o projeto, pois todos os recursos finais estão versionados.

## Fontes

Pixelify Sans e Nunito Sans, disponibilizadas pelo Google Fonts sob SIL Open Font License. São arquivos locais; a interface não depende de servidores externos de fontes. As licenças acompanham os arquivos.

## Arte original gerada

Produzida com a ferramenta integrada de geração de imagens. Os arquivos finais ficam no diretório público do frontend, sem dependência da pasta de geração da ferramenta.

- `art/classroom.png`: laboratório de informática em pixel art, luz do pôr do sol pela esquerda, computadores ao fundo, livros, plantas e globo à direita; centro escuro e sem interface, texto ou personagens.
- `art/avatars.png`: atlas de 24 personagens originais em quatro colunas e seis linhas, fundo transparente, bonés e camisetas variados, com diferentes tons de pele e cabelos. O frontend recorta os quadros pela posição de fundo CSS e aplica animações de estado.
- `items/mouse.png`: mouse cinza com roda vermelha e fio, contornos azul-marinho, pixels visíveis, fundo transparente, sem texto.
- Artes adicionais de pasta amarela e sinal Wi-Fi azul seguem a mesma direção de pixel art, fundo transparente e sem texto.

O limite de 30 novas imagens do catálogo é respeitado. Os personagens e o laboratório são recursos próprios de cenário e identidade visual.

O cenário e o atlas são servidos em WebP sem perdas. A conversão preservou todos os pixels visíveis e reduziu os dois arquivos de 3.067 KB para 2.496 KB (aproximadamente 19%). Os PNG originais permanecem versionados como fontes da arte. Os prompts completos estão em `IMAGE-PROMPTS.md`.
