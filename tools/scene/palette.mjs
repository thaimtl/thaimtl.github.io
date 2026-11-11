// The whole scene shares these colours. Wood tones match the page tokens.
const C = {
  dark: '#2b1a12', wood1: '#6f4a2a', wood2: '#a47945', wood3: '#c99c66', wood4: '#e2c08e',
  skin1: '#8a5236', skin2: '#b4744e', skin3: '#d49a72',
  orange1: '#a4521f', orange2: '#d47a34', orange3: '#f0a85e', yellow1: '#d9a12b', yellow2: '#f3cd55',
  green0: '#1f3a24', green1: '#33573a', green2: '#4c7844', green3: '#6c9a50', green4: '#94b968',
  teal0: '#3b5f66', teal1: '#6a9a9f', teal2: '#98c2c1', teal3: '#c7e2df', sky: '#e2f0ef',
  white0: '#5d6570', white1: '#9aa2ac', white2: '#c4cad1', white3: '#e5e8eb', white4: '#ffffff',
  black0: '#141217', black1: '#28242b', black2: '#3b3d48', grey1: '#6e6964', grey2: '#9b958d', grey3: '#c3beb4',
  red: '#c8281f',
};
const r = (...names) => names.map(n => C[n]);

// Each ramp: outline first, then shadow to highlight.
export const RAMPS = {
  skin: r('dark', 'skin1', 'skin2', 'skin3', 'wood4'),
  eye: r('black0', 'black0', 'black1', 'black1', 'black1'),
  rib: r('white0', 'white1', 'white1', 'white2', 'white3'),
  tea: r('wood2', 'yellow1', 'yellow2', 'yellow2', 'wood4'),
  white: r('white0', 'white1', 'white2', 'white3', 'white4'),
  shirt: r('teal0', 'teal1', 'teal2', 'teal3', 'teal3'),
  blackHair: r('black0', 'black0', 'black1', 'black2', 'white0'),
  trousers: r('black0', 'black2', 'grey1', 'grey1', 'grey2'),
  tanDark: r('dark', 'wood1', 'wood1', 'wood2', 'wood3'),
  orange: r('dark', 'orange1', 'orange2', 'orange3', 'orange3'),
  flesh: r('orange1', 'orange2', 'orange3', 'orange3', 'yellow2'),
  leafy: r('green0', 'green1', 'green2', 'green3', 'green4'),
  clay: r('dark', 'wood1', 'orange1', 'orange2', 'orange3'),
  wood: r('dark', 'wood1', 'wood2', 'wood3', 'wood4'),
  water: r('teal0', 'teal1', 'teal2', 'teal3', 'sky'),
  grass: r('green0', 'green1', 'green2', 'green3', 'green4'),
  far: r('green1', 'teal0', 'teal1', 'teal2', 'teal3'),
  trunk: r('dark', 'dark', 'wood1', 'wood2', 'wood3'),
  stone: r('black2', 'grey1', 'grey2', 'grey3', 'white3'),
  bank: r('dark', 'wood1', 'wood1', 'wood2', 'wood2'),
  board: r('wood1', 'wood2', 'wood3', 'wood4', 'white3'),
};
RAMPS.leaf = RAMPS.leafy;
RAMPS.sky = r('teal3', 'teal3', 'sky', 'sky', 'sky');
RAMPS.flower = r('dark', 'yellow1', 'red', 'yellow2', 'white4');
