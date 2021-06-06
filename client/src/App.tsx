import React, {useEffect, useRef, useState} from 'react';
import {AnimationUtils} from '../../common/src/utils/animationUtils';
import {ServerGame} from '../../server/src/game/serverGame';
import './App.css';
import {ClientGameUI} from './game/clientGameUI';
import {LocalClientSocket, LocalServerSocket} from './localServerMocking';
import {BotClientGame} from '../../bot/src/botClientGame';
import {ClientSocket} from './clientSocket';
import {ClientGame} from './game/clientGame';
import {Utils} from '../../common/src/utils/utils';

const BOTS = false;
const App: React.FC<{width: number; height: number}> = (props) => {
  const client = useRef<ClientGameUI>(null);
  const [died, setDied] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  if (BOTS) {
    useEffect(() => {
      const serverSocket = new LocalServerSocket();
      const serverGame = new ServerGame(serverSocket);
      serverGame.init();

      setTimeout(async () => {
        connect();

        for (let i = 0; i < 25; i++) {
          const options = {
            onDisconnect: () => {
              new BotClientGame(options, new LocalClientSocket());
            },
            onDied: (me: ClientGame) => {
              me.disconnect();
              new BotClientGame(options, new LocalClientSocket());
            },
          };

          new BotClientGame(options, new LocalClientSocket());
          await Utils.timeout(100);
        }
      }, 50);
    }, []);
  } else {
    useEffect(() => {
      connect();
    }, []);
  }

  function connect() {
    (client as React.MutableRefObject<ClientGameUI>).current = new ClientGameUI(
      {
        onDied: () => {
          setDied(true);
        },
        onDisconnect: () => {
          setDisconnected(true);
        },
      },
      new ClientSocket()
    );
  }

  return (
    <div className="App">
      <canvas key={'canvas'} id={'game'} width={props.width} height={props.height} />
      {died && (
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'column',
            top: 0,
            color: 'white',
          }}
        >
          <span style={{fontSize: '3rem'}}>YOU DIED</span>
          <button
            onClick={() => {
              client.current!.rejoin();
              setDied(false);
            }}
          >
            Play Again
          </button>
        </div>
      )}
      {disconnected && (
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'column',
            top: 0,
            color: 'white',
          }}
        >
          <span style={{fontSize: '3rem'}}>DISCONNECTED</span>
          <button
            onClick={() => {
              connect();
              setDisconnected(false);
            }}
          >
            Reconnect
          </button>
        </div>
      )}
      <div style={{position: 'absolute', bottom: 50, right: 50}}>
        <button
          onClick={() => {
            AnimationUtils.start({
              start: client.current!.view.scale,
              finish: 1,
              duration: 500,
              easing: AnimationUtils.easings.linear,
              callback: (c) => {
                client.current!.view.setScale(c);
              },
            });
          }}
        >
          +
        </button>

        <button
          onClick={() => {
            AnimationUtils.start({
              start: client.current!.view.scale,
              finish: 0.2,
              duration: 500,
              easing: AnimationUtils.easings.linear,
              callback: (c) => {
                client.current!.view.setScale(c);
              },
            });
          }}
        >
          -
        </button>
      </div>
    </div>
  );
};

export default App;
