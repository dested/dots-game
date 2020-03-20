import {GameConfig} from './gameConfig';

export type ClientToServerMessage =
  | {
      type: 'join';
    }
  | {
      type: 'resync';
    }
  | {
      type: 'move-dots';
      x: number;
      y: number;
      swarms: {swarmId: number; percent: number}[];
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
  | {type: 'new-emitter'; x: number; y: number; power: number; emitterId: number; teamId: string}
  | {type: 'dead'}
  | {type: 'new-dead-emitter'; x: number; y: number; power: number; life: number; duration: number; emitterId: number}
  | {type: 'set-dead-emitter-life'; life: number; emitterId: number}
  | {type: 'set-dead-emitter-duration'; duration: number; emitterId: number}
  | {type: 'remove-swarm'; swarmId: number}
  | {type: 'kill-emitter'; emitterId: number}
  | {type: 'remove-emitter'; emitterId: number}
  | {type: 'augment-dot-count'; swarmId: number; dotCount: number}
  | {type: 'set-team-data'; teams: {teamId: string; color: string}[]}
  | {
      type: 'new-swarm';
      x: number;
      y: number;
      swarmId: number;
      ownerEmitterId?: number;
      teamId: string;
    }
  | {
      type: 'set-swarm-heading';
      swarmId: number;
      x: number;
      y: number;
    };
