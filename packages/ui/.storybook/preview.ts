import type { Preview } from '@storybook/react-vite';
import '../src/tokens/tokens.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    viewport: { defaultViewport: 'mobile1' },
    a11y: { test: 'error' },
  },
};

export default preview;
