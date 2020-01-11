import React, {useEffect, useRef, useState} from 'react';
import {AnimationUtils} from '../../common/src/utils/animationUtils';
import './App.css';
import {ClientGameUI} from './game/clientGameUI';

const App: React.FC<{width: number; height: number}> = props => {
  const client = useRef<ClientGameUI>(null);
  const [died, setDied] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  useEffect(() => {
    connect();
  }, []);
  function connect() {
    (client as React.MutableRefObject<ClientGameUI>).current = new ClientGameUI({
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
            AnimationUtils.start({
              start: client.current!.view.scale,
              finish: 1,
              duration: 500,
              easing: AnimationUtils.easings.linear,
              callback: c => {
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
              finish: 0.15,
              duration: 500,
              easing: AnimationUtils.easings.linear,
              callback: c => {
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
