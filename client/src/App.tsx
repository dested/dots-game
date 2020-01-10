import React, {useEffect, useRef, useState} from 'react';
import './App.css';
import {ClientGame} from './game/clientGame';

const App: React.FC<{width: number; height: number}> = props => {
  const client = useRef<ClientGame>(null);
  const [died, setDied] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  useEffect(() => {
    connect();
  }, []);
  function connect() {
    (client as React.MutableRefObject<ClientGame>).current = new ClientGame({
      onDied: () => {
        setDied(true);
      },
      onDisconnect: () => {
        setDisconnected(true);
      },
    });
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
            client.current!.view.scale += 0.2;
          }}
        >
          +
        </button>

        <button
          onClick={() => {
            client.current!.view.scale -= 0.2;
          }}
        >
          -
        </button>
      </div>
    </div>
  );
};

export default App;
