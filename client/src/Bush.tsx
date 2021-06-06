///<reference path="../../server/src/types/quickselect.d.ts"/>

import React, {useCallback, useEffect, useRef, useState} from 'react';
import './App.css';

import {BBox, RBush, RNode} from '../../server/src/rbush';

type Player = {x: number; y: number; selected: boolean; bush: RNode<Player>};
const bush = new RBush<Player>();
const players: Player[] = [];
const playerSize = 10;

const mousePosition = {x: 0, y: 0};
export const Bush: React.FC<{width: number; height: number}> = props => {
  const [drawBoxes, setDrawBoxes] = useState(false);
  const [numberOfPlayers, setNumberOfPlayers] = useState(200);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  const scale = 4;
  const range = 500;

  const boardWidth = props.width * scale;
  const boardHeight = props.height * scale;

  useEffect(() => {
    console.time('Start');
    players.length = 0;
    bush.clear();
    for (let i = 0; i < numberOfPlayers; i++) {
      const x = Math.random() * boardWidth;
      const y = Math.random() * boardHeight;
      const player: Player = {
        x,
        y,
        selected: false,
        bush: {
          minX: x - playerSize,
          minY: y - playerSize,
          maxX: x + playerSize,
          maxY: y + playerSize,
          item: undefined as any,
        },
      };
      player.bush.item = player;
      players.push(player);
      bush.insert(player.bush);
    }

    console.timeEnd('Start');
    // setTick(tick + 1);

    // move1();
    // move2();
  }, [numberOfPlayers]);

  const draw = () => {
    console.time('message everyone');
    const searchBox: BBox = {maxX: 0, maxY: 0, minX: 0, minY: 0};
    for (const player of players) {
      player.selected = false;
    }
    searchBox.minX = mousePosition.x - range / 2;
    searchBox.minY = mousePosition.y - range / 2;
    searchBox.maxX = mousePosition.x + range / 2;
    searchBox.maxY = mousePosition.y + range / 2;
    const results = bush.search(searchBox);

    for (const result of results) {
      result.item.selected = true;
    }
    console.timeEnd('message everyone');

    const context = canvas.current!.getContext('2d')!;
    context.save();
    context.clearRect(0, 0, boardWidth, boardHeight);
    context.scale(1 / scale, 1 / scale);

    if (drawBoxes) {
      const rects: [string, number, [number, number, number, number]][] = [];
      drawTree(bush.data, 0, rects);

      for (let i = rects.length - 1; i >= 0; i--) {
        context.strokeStyle = rects[i][0];
        // context.globalAlpha = rects[i][1];
        context.strokeRect.apply(context, rects[i][2]);
      }
    }
    // context.globalAlpha = 1;

    context.fillStyle = 'rgba(24,186,0,0.4)';
    context.fillRect(mousePosition.x - range / 2, mousePosition.y - range / 2, range, range);

    for (const player of players) {
      if (player.selected) {
        context.fillStyle = 'red';
      } else {
        context.fillStyle = 'black';
      }
      context.fillRect(player.x - playerSize / 2, player.y - playerSize / 2, playerSize, playerSize);
    }

    context.restore();
  };

  function drawTree(node: RNode<Player>, level: number, rects: [string, number, [number, number, number, number]][]) {
    if (!node) {
      return;
    }

    const colors = ['#f40', '#0b0', '#37f'];

    const rect: any = [];

    rect.push(level ? colors[(node.height! - 1) % colors.length] : 'grey');
    rect.push(level ? 1 / Math.pow(level, 1.2) : 0.2);
    rect.push([
      Math.round(node.minX),
      Math.round(node.minY),
      Math.round(node.maxX - node.minX),
      Math.round(node.maxY - node.minY),
    ]);

    rects.push(rect);

    if (node.leaf) {
      return;
    }
    if (level === 6) {
      return;
    }
    if (node.children) {
      for (const child of node.children) {
        drawTree(child, level + 1, rects);
      }
    }
  }

  function move2() {
    const moveRange = 5;
    console.time('move everyone');
    bush.clear();
    for (const player of players) {
      player.x = mod(player.x + (Math.random() * moveRange - moveRange / 2), boardWidth);
      player.y = mod(player.y + (Math.random() * moveRange - moveRange / 2), boardHeight);

      player.bush.minX = player.x - playerSize;
      player.bush.minY = player.y - playerSize;
      player.bush.maxX = player.x + playerSize;
      player.bush.maxY = player.y + playerSize;
    }
    bush.load(players.map(a => a.bush));
    console.timeEnd('move everyone');

    // setTick(tick + 1);
  }

  useInterval(() => {
    move2();
  }, 16);

  useInterval(() => {
    draw();
  }, 16);

  function find(x: number, y: number) {
    mousePosition.x = x;
    mousePosition.y = y;
  }

  const onMouseMove = useCallback((move: React.MouseEvent) => {
    find(move.clientX * scale, move.clientY * scale);
  }, []);

  return (
    <div className="App">
      <canvas key={'canvas'} ref={canvas} width={props.width} height={props.height} onMouseMove={onMouseMove} />
      <div style={{position: 'absolute', left: 0, top: 0}}>
        <button
          onClick={() => {
            setDrawBoxes(!drawBoxes);
          }}
        >
          Draw RTree Boxes
        </button>
        <div>
          <label>Players {numberOfPlayers}</label>
          <input
            id={'players'}
            type={'range'}
            min={20}
            max={10000}
            value={numberOfPlayers}
            onChange={e => {
              setNumberOfPlayers(parseInt(e.target.value));
            }}
          />
        </div>
      </div>
    </div>
  );
};

function useInterval(callback: () => void, delay: number) {
  const savedCallback = useRef<() => void>(callback);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

function mod(n: number, p: number) {
  return (n + p) % p;
}
