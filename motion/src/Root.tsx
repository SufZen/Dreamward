import React from 'react';
import { Composition, Folder } from 'remotion';
import { FPS, H, LOOP, W } from './brand';
import { Welcome } from './scenes/Welcome';
import { Chapter } from './scenes/Chapter';
import { Wheel } from './scenes/Wheel';
import { Ikigai } from './scenes/Ikigai';
import { Steps } from './scenes/Steps';
import { Clarity } from './scenes/Clarity';

/** Onboarding loops: one per first-run moment in the app (see README.md). */
const SCENES = [
  ['welcome', Welcome],
  ['chapter', Chapter],
  ['wheel', Wheel],
  ['ikigai', Ikigai],
  ['steps', Steps],
  ['clarity', Clarity],
] as const;

export const RemotionRoot: React.FC = () => (
  <Folder name="onboarding">
    {SCENES.map(([id, component]) => (
      <Composition key={id} id={id} component={component} durationInFrames={LOOP} fps={FPS} width={W} height={H} />
    ))}
  </Folder>
);
