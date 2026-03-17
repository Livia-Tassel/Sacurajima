import { Menu, Tray, nativeImage } from 'electron';

type TrayActions = {
  toggleCompanion: () => void;
  showPanel: () => void;
  quit: () => void;
  isCompanionVisible: () => boolean;
};

function createTrayImage() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <g fill="none" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 3.2c.9 1.2 1.1 2.5.6 3.8C8.9 8.6 7.8 9.5 6.4 9.9c-1 .3-2 .3-3 .1.5-1.3 1.3-2.4 2.6-3.1C7 6.3 8 5.2 9 3.2Z"/>
        <path d="M8.8 3.3c-.4 1.5-.1 2.8.8 3.9 1 1.1 2.3 1.7 3.7 1.8.9 0 1.8-.1 2.7-.4-.7-1.2-1.7-2.1-3.1-2.6-1.1-.4-2.3-1.3-4.1-2.7Z"/>
        <circle cx="9" cy="10.5" r="2.2"/>
        <path d="M6.6 12.7c-.9.2-1.7.7-2.4 1.5.9.4 1.9.6 2.9.4.8-.2 1.4-.6 1.9-1.3"/>
        <path d="M11.4 12.7c.9.2 1.7.7 2.4 1.5-.9.4-1.9.6-2.9.4-.8-.2-1.4-.6-1.9-1.3"/>
      </g>
    </svg>
  `;
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  image.setTemplateImage(true);
  return image;
}

export function createAppTray(actions: TrayActions): Tray {
  const tray = new Tray(createTrayImage());

  const rebuildMenu = () => {
    const companionVisible = actions.isCompanionVisible();

    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: companionVisible ? 'Hide Companion' : 'Show Companion',
          click: () => {
            actions.toggleCompanion();
            rebuildMenu();
          }
        },
        {
          label: 'Open Panel',
          click: () => actions.showPanel()
        },
        {
          type: 'separator'
        },
        {
          label: 'Quit Sakurajima',
          click: () => actions.quit()
        }
      ])
    );
  };

  tray.setToolTip('Sakurajima');
  tray.on('click', () => {
    actions.showPanel();
    rebuildMenu();
  });

  rebuildMenu();
  return tray;
}
