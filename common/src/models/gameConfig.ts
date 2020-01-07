export interface GameConfig {
  emitters: (
    | {
    type: 'dot';
    teamId: string;
    x: number;
    y: number;
    emitterId: string;
    power: number;
  }
    | {
    type: 'dead';
    x: number;
    y: number;
    emitterId: string;
    life: number;
    power: number;
  }
    )[];
  swarms: {teamId: string; x: number; y: number; ownerEmitterId: string | null; swarmId: string; dotCount: number}[];
  teams: {teamId: string; color: string}[];
  gameWidth: number;
  gameHeight: number;
}
