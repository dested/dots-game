import {GameConfig} from './gameConfig';

export type ClientToServerMessage =
  | {
  type: 'join';
}
  | {
  type: 'move-dots';
  x: number;
  y: number;
  swarms: {swarmId: string; percent: number}[];
};

export type ServerToClientMessage =
  | {
  type: 'joined';
  yourTeamId: string;
  startingX: number;
  startingY: number;
}
  | ({
  type: 'game-data';
} & GameConfig)
  | {type: 'new-emitter'; x: number; y: number; power: number; emitterId: string; teamId: string}
  | {type: 'new-dead-emitter'; x: number; y: number; power: number; emitterId: string}
  | {type: 'set-dead-emitter-life'; life: number; emitterId: string}
  | {type: 'remove-swarm'; swarmId: string}
  | {type: 'kill-emitter'; emitterId: string}
  | {type: 'remove-emitter'; emitterId: string}
  | {type: 'augment-dot-count'; swarmId: string; dotCount: number}
  | {type: 'set-team-data'; teams: {teamId: string; color: string}[]}
  | {
  type: 'new-swarm';
  x: number;
  y: number;
  swarmId: string;
  ownerEmitterId: string | null;
  teamId: string;
}
  | {
  type: 'set-swarm-heading';
  swarmId: string;
  x: number;
  y: number;
};
