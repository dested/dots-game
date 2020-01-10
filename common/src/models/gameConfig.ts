export interface GameConfig {
  emitters: GameConfigEmitter[];
  swarms: {
    teamId: string;
    x: number;
    y: number;
    ownerEmitterId: number | null;
    swarmId: number;
    dotCount: number;
    headingX?: number;
    headingY?: number;
  }[];
  teams: {teamId: string; color: string}[];
  gameWidth: number;
  gameHeight: number;
}

export type GameConfigEmitter =
  | {
      type: 'dot';
      teamId: string;
      x: number;
      y: number;
      emitterId: number;
      power: number;
    }
  | {
      type: 'dead';
      x: number;
      y: number;
      emitterId: number;
      life: number;
      power: number;
    };
