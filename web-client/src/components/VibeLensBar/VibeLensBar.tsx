'use client';

import 'vibelens/styles.css';

import VibeLens from 'vibelens';

export function VibeLensBar() {
  return (
    <VibeLens appName='Voyager' position='top' theme='light' fixed={false} />
  );
}
