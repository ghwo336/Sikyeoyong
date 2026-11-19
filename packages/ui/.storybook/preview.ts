import type { Preview } from '@storybook/react-vite';
import '../src/tokens/index.css';

// Design screens are 390px wide (design/tokens.json size.screenWidth).
const preview: Preview = {
  parameters: {
    layout: 'centered',
    viewport: {
      options: {
        design390: {
          name: '시안 390',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
      },
    },
  },
  initialGlobals: {
    viewport: { value: 'design390', isRotated: false },
  },
};

export default preview;
